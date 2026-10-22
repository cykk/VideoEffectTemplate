"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Download, LoaderCircle, Plus, RefreshCw, X } from "lucide-react";
import type { AuthModalDictionary, RaindanceHomeDictionary } from "@markless/shared/src/i18n/types";
import { cn } from "@markless/shared/src/lib/utils";
import { useUserBootstrap } from "@/hooks/use-user-bootstrap";
import { AuthSheet } from "./auth-sheet";
import { CreditsSheet } from "./credits-sheet";
import {
  type Draft,
  buildResumePath,
  createRequestKey,
  readDraft,
  readResumeParams,
  stripResumeParams,
  writeDraft,
} from "./lib/draft";
import { fillTemplate, type CreditPackInfo } from "./lib/format";
import { PhotoError, preparePhoto } from "./lib/image-prepare";
import {
  type RaindanceConfig,
  type RaindanceJob,
  UploadError,
  fetchPlaybackUrl,
  fetchRaindanceConfig,
  fetchRaindanceJob,
  isTerminalStatus,
  photoPreviewUrl,
  submitRaindanceJob,
  uploadPhoto,
  videoDownloadUrl,
} from "./lib/raindance-api";
import { trackRaindance } from "./lib/track";

type SlotStatus = "empty" | "processing" | "uploading" | "ready";
type Slot = { status: SlotStatus; token: string | null; preview: string | null; remote: boolean };
type Phase = "edit" | "submitting" | "running" | "done" | "failed";
type ErrorKey = keyof RaindanceHomeDictionary["generator"]["errors"];

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_FAILURES = 10;
const PAYMENT_POLL_ATTEMPTS = 20;
const PAYMENT_POLL_INTERVAL_MS = 2500;

const emptySlot = (): Slot => ({ status: "empty", token: null, preview: null, remote: false });

interface RaindanceGeneratorProps {
  dictionary: RaindanceHomeDictionary;
  authDictionary: AuthModalDictionary;
  packs: CreditPackInfo[];
  termsHref: string;
}

export function RaindanceGenerator({ dictionary, authDictionary, packs, termsHref }: RaindanceGeneratorProps) {
  const copy = dictionary.generator;
  const { data: user, isFetched, reload } = useUserBootstrap();
  const authenticated = Boolean(user?.authenticated);
  const credits = user?.credits ?? 0;

  const [config, setConfig] = useState<RaindanceConfig | null>(null);
  const [slots, setSlots] = useState<[Slot, Slot]>([emptySlot(), emptySlot()]);
  const [phase, setPhase] = useState<Phase>("edit");
  const [gate, setGate] = useState<"auth" | "credits" | null>(null);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [slotErrors, setSlotErrors] = useState<[ErrorKey | null, ErrorKey | null]>([null, null]);
  const [job, setJob] = useState<RaindanceJob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [paymentWait, setPaymentWait] = useState<"idle" | "confirming" | "pending">("idle");
  const [hydrated, setHydrated] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([null, null]);
  const requestKeyRef = useRef<string | null>(null);
  const uploadSeqRef = useRef([0, 0]);
  const blobUrlsRef = useRef<Array<string | null>>([null, null]);
  const autoStartRef = useRef(false);
  const fromPaymentRef = useRef(false);
  const restoredJobIdRef = useRef<string | null>(null);
  const paymentPollingRef = useRef(false);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const tokens: [string | null, string | null] = [
    slots[0].status === "ready" ? slots[0].token : null,
    slots[1].status === "ready" ? slots[1].token : null,
  ];
  const bothReady = Boolean(tokens[0] && tokens[1]);
  const busyUploading = slots.some((slot) => slot.status === "processing" || slot.status === "uploading");
  const cost = config?.credits ?? null;
  const resumePath = buildResumePath(tokens.filter((token): token is string => Boolean(token)));

  const releaseBlob = (index: number) => {
    const url = blobUrlsRef.current[index];
    if (url) URL.revokeObjectURL(url);
    blobUrlsRef.current[index] = null;
  };

  const patchSlot = (index: number, next: Slot) =>
    setSlots((current) => (index === 0 ? [next, current[1]] : [current[0], next]));

  const patchSlotError = (index: number, value: ErrorKey | null) =>
    setSlotErrors((current) => (index === 0 ? [value, current[1]] : [current[0], value]));

  // ---------- 初始化：恢复草稿、回跳参数、配置 ----------
  useEffect(() => {
    const resume = readResumeParams();
    const draft = readDraft();
    const fromUrl = Boolean(resume && (resume.tokens[0] || resume.tokens[1]));
    const restoredTokens = fromUrl ? resume!.tokens : draft.tokens;
    const sameSet = restoredTokens[0] === draft.tokens[0] && restoredTokens[1] === draft.tokens[1];
    requestKeyRef.current = sameSet ? draft.requestKey : null;
    restoredJobIdRef.current = sameSet ? draft.jobId : null;
    autoStartRef.current = Boolean(resume?.autoStart);
    fromPaymentRef.current = Boolean(resume?.fromPayment);

    setSlots(
      restoredTokens.map((token) =>
        token ? { status: "ready", token, preview: photoPreviewUrl(token), remote: true } : emptySlot(),
      ) as [Slot, Slot],
    );
    stripResumeParams();
    setHydrated(true);

    let active = true;
    void fetchRaindanceConfig().then((value) => {
      if (active) setConfig(value);
    });
    const blobUrls = blobUrlsRef.current;
    return () => {
      active = false;
      blobUrls.forEach((url) => url && URL.revokeObjectURL(url));
    };
  }, []);

  // ---------- 草稿持久化 ----------
  useEffect(() => {
    if (!hydrated) return;
    const draft: Draft = { tokens, requestKey: requestKeyRef.current, jobId: job?.id ?? null };
    writeDraft(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, tokens[0], tokens[1], job?.id]);

  // ---------- 选图：压缩、上传 ----------
  const handleFile = async (index: number, file: File | undefined) => {
    if (!file) return;
    const seq = ++uploadSeqRef.current[index];
    const stale = () => uploadSeqRef.current[index] !== seq;
    patchSlotError(index, null);
    setErrorKey(null);
    releaseBlob(index);
    requestKeyRef.current = null;
    patchSlot(index, { status: "processing", token: null, preview: null, remote: false });
    try {
      const blob = await preparePhoto(file);
      if (stale()) return;
      const preview = URL.createObjectURL(blob);
      blobUrlsRef.current[index] = preview;
      patchSlot(index, { status: "uploading", token: null, preview, remote: false });
      const { token } = await uploadPhoto(blob);
      if (stale()) return;
      patchSlot(index, { status: "ready", token, preview, remote: false });
      trackRaindance(index === 0 ? "raindance_select_photo_1" : "raindance_select_photo_2");
    } catch (error) {
      if (stale()) return;
      releaseBlob(index);
      patchSlot(index, emptySlot());
      let key: ErrorKey = "generic";
      if (error instanceof PhotoError) key = error.code;
      else if (error instanceof UploadError) key = error.code === "invalid" ? "decode" : error.code;
      patchSlotError(index, key);
    }
  };

  const clearSlot = (index: number) => {
    uploadSeqRef.current[index]++;
    releaseBlob(index);
    requestKeyRef.current = null;
    patchSlot(index, emptySlot());
    patchSlotError(index, null);
  };

  // ---------- 任务状态 ----------
  const finishJob = useCallback(
    async (next: RaindanceJob) => {
      setJob(next);
      if (next.status === "succeeded") {
        let url: string | null = null;
        for (let attempt = 0; attempt < 3 && !url; attempt++) {
          url = await fetchPlaybackUrl(next.id);
          if (!url) await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        if (!url) {
          setErrorKey("status");
          setPhase("running");
          return;
        }
        setVideoUrl(url);
        setPhase("done");
        trackRaindance("raindance_generation_success");
      } else {
        setPhase("failed");
        trackRaindance("raindance_generation_failed");
      }
      void reload();
    },
    [reload],
  );

  const applyJob = useCallback(
    (next: RaindanceJob) => {
      setJob(next);
      if (isTerminalStatus(next.status)) void finishJob(next);
      else setPhase("running");
    },
    [finishJob],
  );

  const submit = useCallback(async () => {
    const [first, second] = slotsRef.current.map((slot) => (slot.status === "ready" ? slot.token : null));
    if (!first || !second) return;
    if (!requestKeyRef.current) requestKeyRef.current = createRequestKey();
    writeDraft({ tokens: [first, second], requestKey: requestKeyRef.current, jobId: null });
    setPhase("submitting");
    setErrorKey(null);
    setNotice(null);
    trackRaindance("raindance_generation_start");
    const result = await submitRaindanceJob(requestKeyRef.current, [first, second]);
    if ("job" in result) {
      applyJob(result.job);
      void reload();
      return;
    }
    const { reason } = result;
    setPhase("edit");
    if (reason === "auth") setGate("auth");
    else if (reason === "credits") {
      void reload();
      setGate("credits");
    } else if (reason === "invalid") {
      clearSlot(0);
      clearSlot(1);
      setErrorKey("invalid");
    } else if (reason === "unavailable") setErrorKey("unavailable");
    else setErrorKey("generic");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyJob, reload]);

  const focusFirstEmptySlot = () => {
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const index = slotsRef.current.findIndex((slot) => slot.status === "empty");
    inputRefs.current[index === -1 ? 0 : index]?.click();
  };

  const handleGenerate = () => {
    if (!bothReady) {
      focusFirstEmptySlot();
      return;
    }
    trackRaindance("raindance_click_generate");
    if (isFetched && !authenticated) {
      setGate("auth");
      return;
    }
    if (authenticated && cost !== null && credits < cost) {
      setGate("credits");
      trackRaindance("raindance_credits_view");
      return;
    }
    void submit();
  };

  const resetForAnother = () => {
    setJob(null);
    setVideoUrl(null);
    setErrorKey(null);
    setNotice(null);
    setPhase("edit");
    requestKeyRef.current = null;
  };

  const handleRetry = () => {
    resetForAnother();
    window.setTimeout(handleGenerate, 0);
  };

  // ---------- 登录或支付后自动续跑 ----------
  useEffect(() => {
    if (!autoStartRef.current || !hydrated || !isFetched || !config) return;
    if (!bothReady) {
      autoStartRef.current = false;
      return;
    }
    if (!authenticated) {
      autoStartRef.current = false;
      return;
    }
    if (cost === null || credits >= cost) {
      autoStartRef.current = false;
      trackRaindance("raindance_auth_success");
      void submit();
      return;
    }
    if (fromPaymentRef.current) {
      if (paymentPollingRef.current) return;
      paymentPollingRef.current = true;
      setPaymentWait("confirming");
      void (async () => {
        for (let attempt = 0; attempt < PAYMENT_POLL_ATTEMPTS; attempt++) {
          const result = await reload();
          if ((result.data?.credits ?? 0) >= cost) {
            autoStartRef.current = false;
            setPaymentWait("idle");
            void submit();
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, PAYMENT_POLL_INTERVAL_MS));
        }
        autoStartRef.current = false;
        setPaymentWait("pending");
      })();
      return;
    }
    autoStartRef.current = false;
    setGate("credits");
    trackRaindance("raindance_credits_view");
  }, [hydrated, isFetched, config, bothReady, authenticated, credits, cost, submit, reload]);

  // ---------- 恢复进行中的任务 ----------
  useEffect(() => {
    if (!hydrated || !isFetched || !authenticated || !restoredJobIdRef.current) return;
    const id = restoredJobIdRef.current;
    restoredJobIdRef.current = null;
    void fetchRaindanceJob(id).then((restored) => {
      if (restored) applyJob(restored);
    });
  }, [hydrated, isFetched, authenticated, applyJob]);

  // ---------- 轮询 ----------
  useEffect(() => {
    if (phase !== "running" || !job || isTerminalStatus(job.status)) return;
    let failures = 0;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      const latest = await fetchRaindanceJob(job.id);
      if (cancelled) return;
      if (!latest) {
        if (++failures >= MAX_POLL_FAILURES) {
          window.clearInterval(timer);
          setErrorKey("status");
        }
        return;
      }
      failures = 0;
      if (isTerminalStatus(latest.status)) {
        window.clearInterval(timer);
        void finishJob(latest);
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [phase, job, finishJob]);

  // ---------- 保存视频 ----------
  const handleSave = async () => {
    if (!job || !videoUrl) return;
    trackRaindance("raindance_download", { method: "save" });
    setSaving(true);
    setNotice(null);
    try {
      const blob = await (await fetch(videoUrl)).blob();
      const file = new File([blob], "raindance.mp4", { type: blob.type || "video/mp4" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      window.location.assign(videoDownloadUrl(job.id));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(copy.result.shareFailed);
      window.location.assign(videoDownloadUrl(job.id));
    } finally {
      setSaving(false);
    }
  };

  const isIos = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const editable = phase === "edit" || phase === "failed";
  const unavailable = config !== null && !config.available;
  const showCta = phase === "edit" || phase === "submitting" || phase === "failed";
  const ctaBusy = phase === "submitting" || paymentWait === "confirming";

  const ctaLabel = (() => {
    if (paymentWait === "confirming") return dictionary.gates.credits.confirming;
    if (phase === "submitting") return copy.cta.submitting;
    if (busyUploading) return copy.cta.preparing;
    if (phase === "failed") return copy.cta.retry;
    return cost ? fillTemplate(copy.cta.generateWithCredits, { credits: cost }) : copy.cta.generate;
  })();

  const hint = bothReady ? copy.hint.ready : slots.some((slot) => slot.status !== "empty") ? copy.hint.needOne : copy.hint.needBoth;
  const labels = [copy.slots.first, copy.slots.second];

  return (
    <div ref={rootRef} className="scroll-mt-16">
      {phase === "done" && videoUrl ? (
        <section className="mx-auto mb-6 w-full max-w-sm space-y-3" aria-live="polite">
          <h2 className="text-center text-lg font-semibold text-slate-900">{copy.result.title}</h2>
          <video
            src={videoUrl}
            controls
            playsInline
            loop
            preload="metadata"
            aria-label={copy.result.videoLabel}
            className="aspect-[9/16] w-full rounded-2xl bg-black object-contain"
          />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
            {saving ? copy.result.saving : copy.result.save}
          </button>
          <div className="flex items-center justify-between gap-3">
            <a
              href={videoDownloadUrl(job!.id)}
              onClick={() => trackRaindance("raindance_download", { method: "link" })}
              className="inline-flex min-h-12 items-center text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {copy.result.download}
            </a>
            <button
              type="button"
              onClick={resetForAnother}
              className="inline-flex min-h-12 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {copy.cta.makeAnother}
            </button>
          </div>
          {isIos ? <p className="text-xs text-slate-500">{copy.result.iosHint}</p> : null}
          {notice ? <p className="text-xs text-slate-500">{notice}</p> : null}
        </section>
      ) : null}

      <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-3 sm:gap-4">
        {slots.map((slot, index) => {
          const working = slot.status === "processing" || slot.status === "uploading";
          const inputId = `raindance-photo-${index}`;
          return (
            <div key={index} className="relative">
              <label
                htmlFor={inputId}
                className={cn(
                  "relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition-colors",
                  slot.preview && "border-solid border-transparent",
                  editable ? "hover:border-primary" : "pointer-events-none opacity-70",
                )}
              >
                <input
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  id={inputId}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={!editable}
                  aria-label={slot.preview ? fillTemplate(copy.slots.replace, { index: index + 1 }) : `${labels[index]}: ${copy.slots.add}`}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void handleFile(index, file);
                  }}
                />
                {slot.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slot.preview}
                    alt={fillTemplate(copy.slots.preview, { index: index + 1 })}
                    className="absolute inset-0 size-full object-cover"
                    onError={() => {
                      if (slot.remote) clearSlot(index);
                    }}
                  />
                ) : (
                  <>
                    <Camera className="size-7" aria-hidden="true" />
                    <span className="text-sm font-medium">{labels[index]}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                      <Plus className="size-3" aria-hidden="true" />
                      {copy.slots.add}
                    </span>
                  </>
                )}
                {working ? (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-xs font-medium text-white">
                    <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
                    {slot.status === "processing" ? copy.slots.processing : copy.slots.uploading}
                  </span>
                ) : null}
              </label>
              {slot.preview && editable && !working ? (
                <button
                  type="button"
                  onClick={() => clearSlot(index)}
                  aria-label={fillTemplate(copy.slots.remove, { index: index + 1 })}
                  className="absolute right-1 top-1 flex size-11 cursor-pointer items-center justify-center rounded-full"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
                    <X className="size-4" aria-hidden="true" />
                  </span>
                </button>
              ) : null}
              {slotErrors[index] ? (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {copy.errors[slotErrors[index]!]}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {phase === "running" ? (
        <section className="mx-auto mt-5 w-full max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-live="polite">
          <div className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">{copy.progress.title}</h2>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" role="presentation">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
          <p className="text-sm text-slate-600">{copy.progress.description}</p>
          <p className="text-xs text-slate-500">{copy.progress.tip}</p>
        </section>
      ) : null}

      {phase === "failed" ? (
        <section className="mx-auto mt-5 w-full max-w-sm rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
          <h2 className="text-base font-semibold text-red-900">{copy.failed.title}</h2>
          <p className="mt-1 text-sm text-red-800">{copy.failed.description}</p>
        </section>
      ) : null}

      {unavailable ? (
        <section className="mx-auto mt-5 w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-4" role="status">
          <h2 className="text-base font-semibold text-slate-900">{copy.unavailable.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{copy.unavailable.description}</p>
        </section>
      ) : null}

      {errorKey ? (
        <p role="alert" className="mx-auto mt-4 w-full max-w-sm text-center text-sm text-red-600">
          {copy.errors[errorKey]}
        </p>
      ) : null}
      {paymentWait === "pending" ? (
        <p role="status" className="mx-auto mt-4 w-full max-w-sm text-center text-sm text-slate-600">
          {dictionary.gates.credits.pending}
        </p>
      ) : null}

      {showCta ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-auto sm:mt-5 sm:max-w-sm sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="mx-auto w-full max-w-sm">
            <p className="mb-2 text-center text-xs text-slate-500">{hint}</p>
            <button
              type="button"
              onClick={phase === "failed" ? handleRetry : handleGenerate}
              disabled={ctaBusy || busyUploading || unavailable}
              className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white shadow-lg shadow-primary/25 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ctaBusy || busyUploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              {ctaLabel}
            </button>
            <p className="mt-2 hidden text-center text-xs text-slate-500 sm:block">
              {copy.consent.text}{" "}
              <Link href={termsHref} className="underline underline-offset-2">
                {copy.consent.link}
              </Link>
            </p>
          </div>
        </div>
      ) : null}
      {showCta ? (
        <p className="mx-auto mt-4 w-full max-w-sm text-center text-xs text-slate-500 sm:hidden">
          {copy.consent.text}{" "}
          <Link href={termsHref} className="underline underline-offset-2">
            {copy.consent.link}
          </Link>
        </p>
      ) : null}

      <AuthSheet
        open={gate === "auth"}
        onOpenChange={(open) => setGate(open ? "auth" : null)}
        dictionary={dictionary.gates}
        authDictionary={authDictionary}
        resumePath={resumePath}
      />
      <CreditsSheet
        open={gate === "credits"}
        onOpenChange={(open) => setGate(open ? "credits" : null)}
        dictionary={dictionary.gates.credits}
        packs={packs}
        cost={cost}
        balance={credits}
        resumePath={resumePath}
      />
    </div>
  );
}
