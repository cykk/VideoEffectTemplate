export {
    resolveCurrentStarterAnalyticsContext,
    resolveStarterAnalyticsContext,
    type StarterAnalyticsContext,
    type StarterPageType,
} from "./starter-context";
export {
    GA_READY_EVENT_NAME,
    isProjectGaReady,
} from "./ga-user-identity";
export {
    trackStarterPageView,
} from "./starter-page";
export {
    trackStarterCheckoutStarted,
    trackStarterPurchaseCompleted,
} from "./starter-payment";
export {
    trackUploadCtaClicked,
    trackFileSelected,
    trackUploadStarted,
    trackUploadCompleted,
    trackUploadFailed,
    trackTranscriptionCompleted,
    trackTranscriptionFailed,
    trackTranscriptionGuestAuthClicked,
    trackTranscriptionStarted,
    trackTranscriptionSubscriptionClicked,
    trackTranscriptExport,
    trackTranslationCompleted,
} from "./transcription";
