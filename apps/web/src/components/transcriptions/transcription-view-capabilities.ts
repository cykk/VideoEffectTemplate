export type TranscriptionViewCapabilities = {
  header: {
    showShare: boolean;
    showExport: boolean;
    showMore: boolean;
    showTryAppCta: boolean;
  };
  transcript: {
    search: boolean;
    replace: boolean;
    copy: boolean;
    translate: "full" | "readonly" | "off";
    segmentEdit: boolean;
    speakers: boolean;
    segmentPlay: boolean;
    segmentCopy: boolean;
  };
  summary: {
    view: boolean;
    regenerate: boolean;
    templateSwitch: boolean;
    copy: boolean;
    mindMap: boolean;
    mindMapRefresh: boolean;
    mindMapDownload: boolean;
  };
  playback: {
    enabled: boolean;
    showUpgradeStrip: boolean;
  };
  feedback: {
    rating: boolean;
  };
};

export const SHARE_VIEW_CAPABILITIES: TranscriptionViewCapabilities = {
  header: {
    showShare: false,
    showExport: true,
    showMore: false,
    showTryAppCta: false,
  },
  transcript: {
    search: true,
    replace: false,
    copy: true,
    translate: "readonly",
    segmentEdit: false,
    speakers: false,
    segmentPlay: true,
    segmentCopy: true,
  },
  summary: {
    view: true,
    regenerate: false,
    templateSwitch: false,
    copy: true,
    mindMap: true,
    mindMapRefresh: false,
    mindMapDownload: true,
  },
  playback: {
    enabled: true,
    showUpgradeStrip: false,
  },
  feedback: {
    rating: false,
  },
};

