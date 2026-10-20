export const locales = [
    "en",
] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends object
    ? DeepPartial<T[K]>
    : T[K];
};

export type RichTextSegment =
    | { type: "text"; value: string }
    | { type: "code"; value: string }
    | { type: "link"; text: string; url: string };

export type RichText = RichTextSegment[];

export interface FeatureItem {
    title: string;
    description: string;
    supportingText?: string;
}

export interface UseCaseShowcaseItem {
    title: string;
    subtitle?: string;
    lead: string;
    paragraphs: string[];
    bulletsIntro: string;
    bullets: string[];
    illustrationAlt: string;
    illustrationSrc?: string;
}

export interface TranscriptExampleLine {
    timestamp: string;
    speaker: string;
    text: string;
}

export interface SrtExampleCue {
    index: string;
    timecode: string;
    text: string;
}

export interface SrtExampleDictionary {
    title: string;
    intro: string[];
    audioExampleLabel: string;
    audioQuote: string;
    srtPreviewLabel: string;
    cues: SrtExampleCue[];
    afterSrtParagraphs: string[];
    ctaText?: string;
}

export interface FAQItem {
    question: string;
    answer: string;
}

export type SeoBlock =
    | { type: "title"; text: string }
    | { type: "paragraph"; text: string }
    | { type: "faq"; items: FAQItem[] };

export interface AuthFormDictionary {
    title?: string;
    description?: string;
    withGoogle: string;
    orDivider: string;
    emailPlaceholder: string;
    emailAddressLabel: string;
    sendMagicLink: string;
    messages: {
        emptyEmail: string;
        responseError: string;
        requestError: string;
        success: {
            title: string;
            description: string;
        };
    };
}

export interface AuthPanelDictionary extends AuthFormDictionary {
    signin: {
        title: string;
        description: string;
    };
    signup: {
        title: string;
        description: string;
        descriptionPrefix: string;
        creditHighlight: string;
        descriptionSuffix: string;
        badgeSubtext: string;
        fallbackTitle: string;
        fallbackDescription: string;
        noCreditCardHint: string;
    };
    signedInAs: string;
    sessionLabel: string;
    signOut: string;
    backToHome: string;
    modeSwitch: {
        noAccount: string;
        signUp: string;
        hasAccount: string;
        logIn: string;
    };
    signupBenefits: string[];
    footer: RichText;
}

export interface HeaderDictionary {
    features: string;
    home: string;
    pricing: string;
    faq: string;
    blog: string;
    docs: string;
    tools: string;
    toolsMenu: {
        triggerAria: string;
        items: {
            mp3ToSrt: string;
            m4aToText: string;
        };
    };
    login: string;
    signup: string;
    languageSwitch: string;
    themeSwitch: string;
    lightTheme: string;
    darkTheme: string;
    systemTheme: string;
    userMenu: {
        profile: string;
        membership: string;
        myCreations: string;
        orders: string;
        dashboard: string;
        billing: string;
        subscription: string;
        account: string;
        adminMenu: string;
        signOut: string;
    };
    notificationCenter: {
        title: string;
        markAllRead: string;
        noNotifications: string;
        markRead: string;
    };
    anonymousCredits: {
        freeLabel: string;
        compactLabel: string;
        ariaLabel: string;
    };
    planUsage: {
        badgeAria: string;
        free: {
            badgeLabel: string;
            currentPlanLabel: string;
            metrics: {
                daily: string;
                perFile: string;
            };
            perFileValue: string;
            upgrade: string;
        };
        subscription: {
            badgeLabel: string;
            planTitle: string;
            minutesAvailable: string;
            minutesAvailableRemaining: string;
            minutesUsed: string;
            planResetsOn: string;
            planResetsHintAria: string;
            changePlan: string;
            minutePackMinutesLeft: string;
            minutePackNeverExpires: string;
            minutePackNeverExpiresHintAria: string;
            tierNames: {
                basic: string;
                standard: string;
                pro: string;
            };
        };
        credits: {
            badgeLabel: string;
            title: string;
            minutesAvailable: string;
            neverExpires: string;
            buyMinutes: string;
        };
        interval: {
            monthly: string;
            yearly: string;
        };
    };
}

export interface ToolItem {
    name: string;
    description: string;
}

export interface ToolCategory {
    title: string;
    items: {
        aiKissing?: ToolItem;
        aiHugging?: ToolItem;
    };
}

export interface AuthModalDictionary extends AuthFormDictionary {
    signin: {
        title: string;
        description: string;
    };
    signup: {
        title: string;
        description: string;
        descriptionPrefix: string;
        creditHighlight: string;
        descriptionSuffix: string;
        badgeSubtext: string;
        noCreditCardHint: string;
        offerHighlight: string;
        offerSuffix: string;
        offerLine: string;
        fallbackTitle: string;
        fallbackDescription: string;
    };
    withGitHub: string;
    withEmail: string;
    modeSwitch: {
        noAccount: string;
        signUp: string;
        hasAccount: string;
        logIn: string;
    };
    guestLimit: {
        title: string;
        comparison: {
            guestLabel: string;
            freeAccountLabel: string;
            dailyLimitLine: string;
            durationLimitLine: string;
        };
    };
    benefits: {
        title: string;
        items: string[];
    };
}

export interface TaskCardDictionary {
    toast: {
        deleteSuccess: string;
        deleteError: string;
    };
}

export interface UpgradeModalDictionary {
    title: string;
    description: string;
    currentPlan: string;
    upgradeToPro: string;
    viewAllPlans: string;
    benefits: {
        title: string;
        items: string[];
    };
    features: {
        free: string;
        premium: string;
    };
}

export interface PaymentCreditsSuccessDictionary {
    card: {
        title: string;
        description: string;
    };
    actions: {
        closeAriaLabel: string;
    };
}

export interface ModelDisplayInfo {
    badge: string;
    description: string;
    details: string[];
}

export interface FeatureSection {
    id: string;
    title: string;
    description: string;
    cta: string;
    stats: string[];
}

export interface UsageStep {
    title: string;
    description: string;
}

export interface ToolsSidebarDictionary {
    home: string;
    workspace: string;
    myCreations: string;
    videoEffects: string;
    categories: {
        aiVideo: string;
        aiImage: string;
    };
    items: Record<string, never>;
}

export interface ToolsMenuDictionary {
    home: {
        displayName: string;
        fullName: string;
    };
    categories: {
        aiVideo: {
            displayName: string;
            fullName: string;
        };
        aiImage: {
            displayName: string;
            fullName: string;
        };
    };
    items: Record<string, never>;
}

export interface ImageCropModalDictionary {
    title: string;
    aspectRatio: string;
    reset: string;
    cancel: string;
}

export interface ToolsDictionary {
    sidebar: ToolsSidebarDictionary;
    menu: ToolsMenuDictionary;
    categories: {
        aiVideos: ToolCategory;
        aiImages: ToolCategory;
        aiEffects: ToolCategory;
    };
    common: {
        upload: string;
        generate: string;
        download: string;
        processing: string;
        examples: string;
        howItWorks: string;
        features: string;
        faq: string;
        relatedTools: string;
    };
    authModal: AuthModalDictionary;
    payment: {
        creditsSuccess: PaymentCreditsSuccessDictionary;
    };
    imageCropModal: ImageCropModalDictionary;
    taskCard: TaskCardDictionary;
    upgradeModal: UpgradeModalDictionary;
}

export interface FooterDictionary {
    description: string;
    tools: string;
    product: string;
    pricing: string;
    blog: string;
    membership: string;
    account: string;
    login: string;
    signup: string;
    company: string;
    privacyPolicy: string;
    termsOfService: string;
    links: string;
    support: {
        label: string;
        email: string;
    };
    contact: string;
    cookies: string;
    copyright: string;
    madeWithLove: string;
}

export interface ComponentLayoutBrandIdentityDictionary {
    primary_name: string;
    support_label: string;
    home_aria_label: string;
}

export interface ComponentLayoutHeaderDictionary {
    actions: {
        toggle_menu: string;
    };
    mobile: {
        signup_button: string;
    };
    brand: {
        identity: ComponentLayoutBrandIdentityDictionary;
    };
}

export interface ComponentLayoutFooterDictionary {
    brand_name: string;
    brand: {
        identity: ComponentLayoutBrandIdentityDictionary;
        discovery: {
            site_hint: string;
        };
    };
}

export interface ComponentLayoutDictionary {
    header: ComponentLayoutHeaderDictionary;
    footer: ComponentLayoutFooterDictionary;
}

export interface ComponentMembershipSidebarDictionary {
    header: {
        title: string;
    };
    mobile: {
        title: string;
    };
    nav: {
        overview: string;
        transcriptions: string;
        credits: string;
        subscription: string;
        orders: string;
        account: string;
    };
    actions: {
        open_menu: string;
        close_menu: string;
    };
}

export interface ComponentMembershipDictionary {
    sidebar: ComponentMembershipSidebarDictionary;
}

export interface ComponentPricingDictionary {
    header: {
        title: string;
        subtitle: string;
        yearlyDiscount: string;
    };
    card: {
        popular: string;
        getStarted: string;
        buyNow: string;
        contactSales: string;
        included: string;
        limitations: string;
        save: string;
        processing: string;
    };
    billingToggle: {
        discount: string;
    };
    billingCycles: {
        oneTime: {
            label: string;
            description: string;
        };
        monthly: {
            label: string;
            description: string;
        };
        yearly: {
            label: string;
            description: string;
        };
    };
    currentPlanBanner: {
        planActive: string;
        renewsOn: string;
        yearly: string;
        monthly: string;
        creditsPerMonth: string;
        currentPlanBadge: string;
        currentActiveButton: string;
        updatePlan: string;
        switchToYearly: string;
        switchToMonthly: string;
    };
    subscriptionManagement: {
        resumeSubscription: string;
        gotIt: string;
    };
}

export interface ComponentDictionary {
    layout: ComponentLayoutDictionary;
    membership: ComponentMembershipDictionary;
    pricing: ComponentPricingDictionary;
}

export interface PageMarketingLandingDictionary {
    metadata: {
        title: string;
        description: string;
        og_image_alt: string;
    };
}

export interface PageMarketingDictionary {
    landing: PageMarketingLandingDictionary;
    mp3ToSrt: PageMarketingLandingDictionary;
    m4aToText: PageMarketingLandingDictionary;
}

export interface PageI18nDictionary {
    marketing: PageMarketingDictionary;
}

export interface PageDictionary {
    title: string;
    subtitle: string;
    description: string;
    development?: {
        inActiveDevelopment: string;
        comingSoon: string;
        underDevelopment: string;
    };
}

export interface TranscriptionsPageDictionary extends PageDictionary {
    status: {
        queued: string;
        preprocessing: string;
        transcribing: string;
        preparingFile: string;
        preparingAudio: string;
        startingTranscription: string;
        transcribingRecording: string;
        stillTranscribing: string;
        succeeded: string;
        failed: string;
    };
    sourceTypes: {
        audio: string;
        video: string;
    };
    summary: {
        heading: string;
        fileName: string;
        sourceType: string;
        duration: string;
        language: string;
        speakers: string;
        createdAt: string;
        progress: string;
        statusMessage: string;
        connection: string;
    };
    states: {
        loading: string;
        connecting: string;
        connected: string;
        reconnecting: string;
        disconnected: string;
    };
    skeleton: {
        loadingTranscript: string;
    };
    content: {
        fullText: string;
        segments: string;
        segmentFallbackSpeaker: string;
        unidentifiedSpeaker: string;
        unknownValue: string;
    };
    empty: {
        pendingTitle: string;
        pendingDescription: string;
        failedTitle: string;
        failedDescription: string;
        noSegments: string;
    };
    resultRecovery: {
        description: string;
        checkButton: string;
        checkAgainButton: string;
        checkingButton: string;
        stillProcessing: string;
    };
    errors: {
        loadFailed: string;
        notFound: string;
    };
    actions: {
        backHome: string;
        retry: string;
        copyText: string;
    };
    toolbar: {
        rating: {
            label: string;
            dismissAria: string;
            starAria: string;
        };
        actions: {
            searchAria: string;
            searchTooltip: string;
            replaceAria: string;
            replaceTooltip: string;
            copyAria: string;
            copyTooltip: string;
            translateAria: string;
            translateTooltip: string;
            speakersAria: string;
            speakersTooltip: string;
            shareAria: string;
            moreAria: string;
            rename: string;
            resizeSummaryAria: string;
        };
    };
    translation: {
        popoverAria: string;
        title: string;
        closeAria: string;
        targetLanguageLabel: string;
        languageSearchPlaceholder: string;
        languageNoResults: string;
        languageListAria: string;
        startButton: string;
        startButtonLoading: string;
        retranslateButton: string;
        retryButton: string;
        outdatedLabel: string;
        inProgressTitle: string;
        progressBanner: {
            titlePrefix: string;
            description: string;
            ariaLabel: string;
        };
        displayModeLabel: string;
        displayModeAria: string;
        displayModeOriginal: string;
        displayModeTranslation: string;
        toasts: {
            startError: string;
            loadError: string;
            failed: string;
        };
    };
    searchReplace: {
        popoverAria: string;
        closeAria: string;
        tabs: {
            search: string;
            replace: string;
        };
        searchLabel: string;
        searchPlaceholder: string;
        replaceLabel: string;
        replacePlaceholder: string;
        matchCounter: string;
        noResults: string;
        prevMatchAria: string;
        nextMatchAria: string;
        replaceOne: string;
        replaceAll: string;
        toast: {
            replaceOneSuccess: string;
            replaceAllSuccess: string;
            replaceFailed: string;
            noMatches: string;
        };
    };
    ratingFeedback: {
        title: string;
        improvePrompt: string;
        placeholder: string;
        charCount: string;
        feedbackRequired: string;
        submitError: string;
        cancel: string;
        send: string;
        closeAria: string;
        starDisplayAria: string;
        submitSuccess: string;
        thankYou: string;
    };
    exportDialog: {
        triggerLabel: string;
        title: string;
        description: string;
        formatSectionTitle: string;
        optionsSectionTitle: string;
        formats: {
            txt: string;
            docx: string;
            pdf: string;
            csv: string;
            srt: string;
            vtt: string;
        };
        subtitleLayout: {
            sectionTitle: string;
            sectionDescription: string;
            maxCharsPerCueLabel: string;
            maxDurationSecondsLabel: string;
            maxCharsPerCueInvalid: string;
            maxDurationSecondsInvalid: string;
            editedTimingNotice: {
                message: string;
            };
        };
        showSpeakerNames: string;
        showTimestamps: string;
        exportButton: string;
        closeAria: string;
        formatAria: string;
        exportPending: string;
        exportingAria: string;
        exportSuccess: string;
        exportError: string;
    };
    toast: {
        copySuccess: string;
        copyError: string;
    };
    segmentEdit: {
        actions: {
            playAria: string;
            playTooltip: string;
            copyAria: string;
            copyTooltip: string;
            editAria: string;
            editTooltip: string;
            saveAria: string;
            cancelAria: string;
        };
        toast: {
            blockedWhileEditing: string;
            switchAutoSave: string;
            saveSuccess: string;
            saveError: string;
            copySuccess: string;
            copyError: string;
        };
        speakerEdit: {
            editAria: string;
            editTooltip: string;
        };
    };
    speakerEditDialog: {
        title: string;
        inputAria: string;
        cancelButton: string;
        applyButton: string;
        applyToAllButton: string;
        applyPending: string;
        applyToAllPending: string;
        savePending: string;
        closeAria: string;
        validationEmpty: string;
        validationTooLong: string;
        saveSuccessSingle: string;
        saveSuccessAll: string;
        saveSuccess: string;
        saveError: string;
    };
    summaryPanel: {
        tabs: {
            summary: string;
            mindmap: string;
        };
        template: {
            off: string;
            general: string;
        };
        actions: {
            refreshAria: string;
            copyAria: string;
            regenerateTooltip: string;
            copyTooltip: string;
            refreshQueued: string;
            copySuccess: string;
            copyError: string;
            updateError: string;
        };
        empty: {
            title: string;
            overview: string;
            keyPoints: string;
            takeaways: string;
            generateCta: string;
            generateDisabledTooltip: string;
        };
        content: {
            overview: string;
            keyPoints: string;
            takeaways: string;
        };
        states: {
            generating: string;
            waitingForTranscript: string;
            refreshing: string;
            failedNotice: string;
            failedTitle: string;
            failedBody: string;
            retryCta: string;
        };
        mock: {
            overview: string;
            keyPoint1Title: string;
            keyPoint1Body: string;
            keyPoint2Title: string;
            keyPoint2Body: string;
        };
        mindmap: {
            generating: string;
            waitingForTranscript: string;
            generateCta: string;
            generateDisabledTooltip: string;
            failedTitle: string;
            failedBody: string;
            retryCta: string;
            diagramLabel: string;
            viewportAria: string;
            downloadError: string;
            downloadPngSuccess: string;
            downloadMarkdownSuccess: string;
            downloadXmindSuccess: string;
            fullscreenError: string;
            toolbar: {
                refreshAria: string;
                downloadAria: string;
                downloadPng: string;
                downloadMarkdown: string;
                downloadXmind: string;
                zoomInAria: string;
                zoomOutAria: string;
                fitAria: string;
                fullscreenAria: string;
                exitFullscreenAria: string;
            };
        };
    };
    playback: {
        playAria: string;
        pauseAria: string;
        skipBackAria: string;
        skipForwardAria: string;
        scrubAria: string;
        volumeAria: string;
        muteAria: string;
        volumeSliderAria: string;
        volumePopoverLabel: string;
        speedAria: string;
        truncationBanner: string;
        truncationPreviewTitle: string;
        truncationUnlockDescription: string;
        truncationRemaining: string;
        upgradeCta: string;
    };
    truncation: {
        previewLine: string;
        unlockLine: string;
        remainingLine: string;
    };
    upgradePlanCard: {
        limitReached: {
            title: string;
            description: string;
            previewLine: string;
            unlockLine: string;
        };
        upgrade: {
            title: string;
            description: string;
        };
        dialog: {
            closeAria: string;
        };
        plan: {
            badge: string;
            title: string;
            features: string[];
        };
        billing: {
            groupAria: string;
            yearlyLabel: string;
            monthlyLabel: string;
            cancelAnytime: string;
        };
        cta: {
            processing: string;
            viewAllPlans: string;
            subscriptionReassurance: string;
        };
    };
    mobileWorkspace: {
        tabBarAria: string;
        summaryProcessingAria: string;
        mindMapProcessingAria: string;
    };
    shareGate: {
        title: string;
        description: string;
        signUpButton: string;
        cancelButton: string;
        closeAria: string;
    };
    renameDialog: {
        title: string;
        inputAria: string;
        cancelButton: string;
        saveButton: string;
        savePending: string;
        closeAria: string;
        validationEmpty: string;
        validationTooLong: string;
        saveSuccess: string;
        saveError: string;
    };
    shareDialog: {
        title: string;
        description: string;
        descriptionSecondary: string;
        statusEnabled: string;
        statusDisabled: string;
        statusDisabledHint: string;
        linkLabel: string;
        linkPlaceholder: string;
        enableButton: string;
        enablePending: string;
        disableButton: string;
        copyButton: string;
        copyCopiedButton: string;
        revokePending: string;
        closeAria: string;
        toasts: {
            loadError: string;
            enableError: string;
            revokeError: string;
            copySuccess: string;
            copyError: string;
        };
    };
    sharedPage: {
        metadataTitle: string;
        metadataDescription: string;
        badge: string;
        unavailableTitle: string;
        unavailableDescription: string;
        titleFallback: string;
        summaryTitle: string;
        transcriptTitle: string;
        audioTitle: string;
        languageLabel: string;
        languageOriginal: string;
        languageLoading: string;
        copyTranscript: string;
        copySuccess: string;
        copyError: string;
        openAppCta: string;
        backAria: string;
        loadingTitle: string;
        loadingDescription: string;
    };
    scrollJump: {
        toTop: string;
        toBottom: string;
        toTopAria: string;
        toBottomAria: string;
    };
    sidebar: {
        plan: {
            title: string;
            guestBadge: string;
            dailyLabel: string;
            dailyValue: string;
            upgradeCta: string;
            signupCta: string;
        };
        actions: {
            upload: string;
            pasteLink: string;
            saveTranscript: string;
        };
    };
}

export interface TeamMember {
    name: string;
    role: string;
    description: string;
    avatar: string;
}

export interface CompanyValue {
    icon: string;
    title: string;
    description: string;
}


export interface QuickStartStep {
    step: string;
    title: string;
    description: string;
    code: string;
}

export interface DocSectionLink {
    name: string;
    href: string;
}

export interface DocSection {
    title: string;
    description: string;
    icon: string;
    links: DocSectionLink[];
}

export interface DocsPageDictionary extends PageDictionary {
    quickStart: {
        title: string;
        subtitle: string;
        steps: QuickStartStep[];
    };
    navigation: {
        title: string;
        subtitle: string;
        sections: DocSection[];
    };
    support: {
        title: string;
        subtitle: string;
        description: string;
        discordButton: string;
        faqButton: string;
    };
}

export interface PricingPlan {
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    limitations: string[];
    cta: string;
    popular: boolean;
}

export interface SubscriptionChangeModalDictionary {
    upgrade: {
        firstTime: {
            title: string;
            badge: string;
        };
        subsequent: {
            title: string;
            badge: string;
        };
        buttonText: string;
        loadingText: string;
    };
    downgrade: {
        title: string;
        buttonText: string;
        loadingText: string;
    };
    switchToYearly: {
        title: string;
        buttonText: string;
    };
    switchToMonthly: {
        title: string;
        buttonText: string;
        loadingText: string;
    };
    labels: {
        current: string;
        newPlan: string;
        credits: string;
        perMonth: string;
        perMonthFull: string;
        billedYearly: string;
        billedMonthly: string;
    };
    highlights: {
        totalDueToday: string;
        credits: string;
        creditsAdded: string;
        existingBalance: string;
        creditsReceived: string;
        effective: string;
        currentBenefits: string;
        charges: string;
        billingCycle: string;
        flexibility: string;
    };
    badges: {
        fullAmount: string;
        rollover: string;
        difference: string;
        prorated: string;
        firstMonth: string;
    };
    values: {
        calculating: string;
        save: string;
        savePercent: string;
        immediately: string;
        nextBillingCycle: string;
        activeUntil: string;
        noCharges: string;
        monthlyBilling: string;
        creditsRollover: string;
        creditsDifference: string;
        instantGrant: string;
        keepsCurrentCycle: string;
        daysRemaining: string;
        currentCycleContinues: string;
        yearlyBillingStarts: string;
        includesCredit: string;
        creditsPerMonth: string;
        totalPerYear: string;
        inTotal: string;
    };
    buttons: {
        cancel: string;
    };
}

export interface PremiumUpgradeModalDictionary {
    tabs: {
        subscription: string;
        creditPacks: string;
    };
    title: string;
    yearly: {
        badge: string;
        title: string;
        perMonth: string;
        perMonthSlash: string;
        strikethroughPrice: string;
        totalCredits: string;
        creditsPerMonth: string;
        notice: string;
    };
    monthly: {
        title: string;
        perMonth: string;
        perMonthSlash: string;
        strikethroughPrice: string;
        creditsPerMonth: string;
    };
    buttons: {
        manageSubscription: string;
        viewPlans: string;
    };
    creditPacks: {
        credits: string;
        perCredit: string;
        totalPrice: string;
        creditsLabel: string;
        pricePerCredit: string;
    };
}

export interface UpgradeSuccessModalDictionary {
    title: string;
    description: string;
    interval: {
        yearly: string;
        monthly: string;
    };
    creditBalance: {
        title: string;
        credits: string;
        remaining: string;
        new: string;
    };
    features: {
        priority: {
            title: string;
            description: string;
        };
        premium: {
            title: string;
            description: string;
        };
        quality: {
            title: string;
            description: string;
        };
    };
    cta: string;
    hint: string;
}

export interface CreditPackagesListDictionary {
    title: string;
    description: string;
    memberBenefits: {
        yearlySubscriber: {
            title: string;
            description: string;
        };
        monthlySubscriber: {
            title: string;
            description: string;
        };
        freeUser: {
            title: string;
            description: string;
        };
    };
    features: {
        neverExpire: {
            title: string;
            description: string;
        };
        securePayment: {
            title: string;
            description: string;
        };
        instantDelivery: {
            title: string;
            description: string;
        };
    };
    betterValue: {
        title: string;
        description: string;
        lite: string;
        pro: string;
        planTemplate: string;
        creditsPerMonth: string;
        perMonth: string;
        off: string;
    };
}

export interface PricingWithTabsDictionary {
    subscriptionFeatures: {
        recurringCredits: string;
        cancelAnytime: string;
        prioritySupport: string;
    };
    separator: string;
    creditPacks: {
        badge: string;
        title: string;
        description: string;
        viewMore: string;
    };
    subscriptionPromo: {
        title: string;
        description: string;
        cta: string;
    };
}

export interface PricingWithSliderDictionary {
    yearlyPlan: {
        badge: string;
        title: string;
        perMonth: string;
        creditsPerMonth: string;
        creditsPerMonthShort: string;
        totalPerYear: string;
    };
    monthlyPlan: {
        title: string;
        perMonth: string;
        creditsPerMonth: string;
        creditsPerMonthShort: string;
    };
    buttons: {
        buyNow: string;
        manageSubscription: string;
        currentActive: string;
        upgradePlan: string;
        switchToYearly: string;
        switchToMonthly: string;
        processing: string;
    };
    status: {
        loading: string;
        planActive: string;
        subscriptionCanceled: string;
        accessEndsOn: string;
        creditsPerMonth: string;
        yearly: string;
        monthly: string;
        currentPlanBadge: string;
    };
    errors: {
        changePlanFailed: string;
    };
}

export interface CreditPackageCardDictionary {
    labels: {
        credits: string;
        memberPrice: string;
        off: string;
    };
    savings: {
        saveMoney: string;
        savePercent: string;
    };
    buttons: {
        purchaseNow: string;
    };
    benefits: {
        neverExpire: string;
    };
}

export interface PricingCalculatorDictionary {
    labels: {
        videosPerMonth: string;
        recommendedPlan: string;
        estimatedCost: string;
        perMonth: string;
    };
    hint: string;
}

export interface SimpleFaqDictionary {
    contact: {
        prefix: string;
        email: string;
    };
}

export interface PlanTypeToggleDictionary {
    subscriptionPlans: string;
    creditPacks: string;
}

export interface PricingCardDictionary {
    billedAnnually: string;
}

export interface FinalCtaDictionary {
    title: string;
    choosePlan: string;
}

export interface PricingTwoColumnDictionary {
    freePlan: {
        title: string;
        creditsLabel: string;
        description: string;
        currentPlan: string;
        cta: string;
        footerHint: string;
    };
    oneTimePayment: {
        title: string;
        description: string;
        closeAriaLabel: string;
        processing: string;
        buyNow: string;
        selectPackage: string;
        bestValueBadge: string;
        creditsLabel: string;
        perCredit: string;
    };
}

export interface PricingSubscriptionPlanCopy {
    name: string;
    description: string;
    cta: string;
    features: string[];
}

export interface PricingOneTimePlanCopy {
    name: string;
    description: string;
    cta: string;
    features: string[];
}

export interface PricingSubscriptionGridDictionary {
    billingToggle: {
        oneTime: string;
        monthly: string;
        annual: string;
        annualSaveBadge: string;
    };
    mostPopular: string;
    processing: string;
    status: {
        loading: string;
        unavailable: string;
        manageSubscription: string;
        upgrade: string;
        checkoutNotReady: string;
        checkoutConfigError: string;
        upgradeSuccess: string;
        upgradeFailed: string;
    };
    price: {
        perMonth: string;
        perYear: string;
        billedYearly: string;
        billedOneTimeYearly: string;
        noCreditCardRequired: string;
        oneTimeUnavailable: string;
    };
    oneTimePlans: {
        basic: PricingOneTimePlanCopy;
        standard: PricingOneTimePlanCopy;
    };
    plans: {
        free: PricingSubscriptionPlanCopy & {
            currentPlan: string;
        };
        basic: PricingSubscriptionPlanCopy;
        standard: PricingSubscriptionPlanCopy;
        pro: PricingSubscriptionPlanCopy;
    };
}

export interface AppUpgradeDialogDictionary {
    title: string;
    closeAria: string;
    contextStrip: {
        creditsLabel: string;
        freePlan: string;
        paidPlan: string;
    };
    interval: {
        monthly: string;
        yearly: string;
    };
}

export interface PricingPageDictionary extends PageDictionary {
    plansSectionTitle: string;
    faqTitle: string;
    faqSubtitle: string;
    faqs: FAQItem[];
    subscriptionChangeModal: SubscriptionChangeModalDictionary;
    premiumUpgradeModal: PremiumUpgradeModalDictionary;
    upgradeSuccessModal: UpgradeSuccessModalDictionary;
    creditPackagesList: CreditPackagesListDictionary;
    pricingWithTabs: PricingWithTabsDictionary;
    pricingWithSlider: PricingWithSliderDictionary;
    creditPackageCard: CreditPackageCardDictionary;
    pricingCalculator: PricingCalculatorDictionary;
    simpleFaq: SimpleFaqDictionary;
    planTypeToggle: PlanTypeToggleDictionary;
    pricingCard: PricingCardDictionary;
    finalCta: FinalCtaDictionary;
    pricingTwoColumn: PricingTwoColumnDictionary;
    subscriptionGrid: PricingSubscriptionGridDictionary;
    appUpgradeDialog: AppUpgradeDialogDictionary;
}

export interface FeatureDetail {
    icon: string;
    title: string;
    description: string;
    highlights: string[];
}

export interface TechStackDetail {
    name: string;
    description: string;
}

export interface ComparisonItem {
    text: string;
}

export interface FeaturesPageDictionary extends PageDictionary {
    coreFeatures: {
        title: string;
        subtitle: string;
        features: FeatureDetail[];
    };
    techStack: {
        title: string;
        subtitle: string;
        technologies: TechStackDetail[];
    };
    comparison: {
        title: string;
        subtitle: string;
        traditional: {
            title: string;
            items: ComparisonItem[];
        };
        platform: {
            title: string;
            checkmark: string;
            items: ComparisonItem[];
        };
    };
    cta: {
        title: string;
        subtitle: string;
        primaryButton: string;
        secondaryButton: string;
    };
}

export interface IntegrationCategory {
    name: string;
    description: string;
    icon: string;
    integrations: IntegrationItem[];
}

export interface IntegrationItem {
    name: string;
    description: string;
    logo: string;
    status: "available" | "coming-soon" | "beta";
    features: string[];
    documentation?: string;
}

export interface IntegrationsPageDictionary extends PageDictionary {
    categories: IntegrationCategory[];
    popularIntegrations: {
        title: string;
        subtitle: string;
        items: IntegrationItem[];
    };
    gettingStarted: {
        title: string;
        subtitle: string;
        steps: QuickStartStep[];
    };
    cta: {
        title: string;
        subtitle: string;
        primaryButton: string;
        secondaryButton: string;
    };
}

export interface HelpCategory {
    title: string;
    description: string;
    icon: string;
    articles: HelpArticle[];
}

export interface HelpArticle {
    title: string;
    description: string;
    href: string;
    tags: string[];
}

export interface HelpPageDictionary extends PageDictionary {
    searchPlaceholder: string;
    popularArticles: {
        title: string;
        subtitle: string;
        articles: HelpArticle[];
    };
    categoriesTitle: string;
    categoriesSubtitle: string;
    categories: HelpCategory[];
    faq: {
        title: string;
        subtitle: string;
        faqs: FAQItem[];
    };
    contact: {
        title: string;
        subtitle: string;
        description: string;
        emailButton: string;
        discordButton: string;
    };
}

export interface ContactMethod {
    icon: string;
    title: string;
    description: string;
    action: string;
    href: string;
}

export interface ContactTeam {
    name: string;
    email: string;
    description: string;
}

export interface ResponseTime {
    time: string;
    title: string;
    description: string;
}

export interface SupportCategory {
    icon: string;
    title: string;
    description: string;
    examples: string[];
    emailSubject: string;
}

export interface ContactPageDictionary extends PageDictionary {
    contactMethods: ContactMethod[];
    team: ContactTeam[];
    responseTimes: ResponseTime[];
    contactMethodsTitle: string;
    contactMethodsSubtitle: string;
    teamTitle: string;
    teamSubtitle: string;
    responseTimeTitle: string;
    responseTimeSubtitle: string;
    responseTimeLabel: string;
    availabilityLabel: string;
    availabilityValue: string;
    supportSectionTitle: string;
    supportSectionSubtitle: string;
    supportCategories: SupportCategory[];
    ctaStrip: {
        title: string;
        description: string;
        buttonText: string;
    };
}

export interface ServiceInfo {
    name: string;
    description: string;
}

export interface StatusPageDictionary extends PageDictionary {
    overview: {
        title: string;
        subtitle: string;
        allSystemsOperational: string;
        lastUpdated: string;
    };
    services: {
        title: string;
        subtitle: string;
        api: ServiceInfo;
        auth: ServiceInfo;
        payments: ServiceInfo;
        database: ServiceInfo;
        cdn: ServiceInfo;
        monitoring: ServiceInfo;
        statusOperational: string;
        statusDegraded: string;
        statusOutage: string;
        uptime: string;
        lastIncident: string;
        none: string;
    };
    subscribe: {
        title: string;
        subtitle: string;
        emailSubscribe: string;
        rssSubscribe: string;
        description: string;
    };
}

export interface PrivacyInfoItem {
    title: string;
    whatWeCollect: string;
    purpose: string;
}

export interface LegalParagraphSection {
    title: string;
    paragraphs: string[];
}

export interface LegalBulletSection {
    title: string;
    paragraphs?: string[];
    items: string[];
}

export interface LegalContactSection {
    title: string;
    paragraphs: string[];
    items: string[];
}

export interface LegalDocumentSection {
    id: string;
    title: string;
    paragraphs?: string[];
    items?: string[];
}

export interface PrivacyCollectionSection {
    title: string;
    description: string;
    items: string[];
}

export interface PrivacyThirdPartyService {
    name: string;
    description: string;
}

export interface PrivacyPageDictionary extends PageDictionary {
    lastUpdated: string;
    legalSummary: LegalBulletSection;
    sections: LegalDocumentSection[];
    contactInformation: LegalContactSection;
}

export interface TermsPageDictionary extends PageDictionary {
    lastUpdated: string;
    legalSummary: LegalBulletSection;
    sections: LegalDocumentSection[];
    contactInformation: LegalContactSection;
}

export interface CookiesPageDictionary extends PageDictionary {
    lastUpdated: string;
    introduction: {
        title: string;
        content: string;
    };
    howWeUseCookies: {
        title: string;
        subtitle: string;
        essential: {
            title: string;
            description: string;
            examples: string[];
        };
        analytics: {
            title: string;
            description: string;
            examples: string[];
        };
        functional: {
            title: string;
            description: string;
            examples: string[];
        };
        marketing: {
            title: string;
            description: string;
            examples: string[];
        };
    };
    cookieTypes: {
        title: string;
        subtitle: string;
        sessionCookies: {
            title: string;
            description: string;
        };
        persistentCookies: {
            title: string;
            description: string;
        };
        firstPartyCookies: {
            title: string;
            description: string;
        };
        thirdPartyCookies: {
            title: string;
            description: string;
        };
    };
    manageCookies: {
        title: string;
        subtitle: string;
        description: string;
        browserSettings: {
            title: string;
            description: string;
            instructions: string[];
        };
        optOut: {
            title: string;
            description: string;
            links: string[];
        };
    };
    dataRetention: {
        title: string;
        content: string;
    };
    updates: {
        title: string;
        content: string;
    };
    contact: {
        title: string;
        content: string;
        email: string;
    };
    consent: {
        content: string;
    };
}

export interface ProfilePageDictionary extends PageDictionary {
    basicInfo: {
        title: string;
        description: string;
        emailLabel: string;
        registrationDate: string;
        unknown: string;
    };
    accountStatus: {
        title: string;
        description: string;
        emailVerification: string;
        accountStatus: string;
        loginMethod: string;
        verified: string;
        unverified: string;
        normal: string;
        oauth: string;
        emailLogin: string;
    };
    actions: {
        editProfile: string;
        changePassword: string;
    };
    noNameSet: string;
}

export interface OrderStatus {
    pending: string;
    paid: string;
    failed: string;
    cancelled: string;
    refunded: string;
}

export interface OrderCardDictionary {
    orderNumber: string;
    status: string;
    amount: string;
    product: string;
    createdAt: string;
    paidAt: string;
    actions: string;
    viewDetails: string;
    refreshStatus: string;
}

export interface OrdersListDictionary {
    title: string;
    subtitle: string;
    noOrders: string;
    loading: string;
    error: string;
    retry: string;
}

export interface OrdersFiltersDictionary {
    title: string;
    all: string;
    pending: string;
    paid: string;
    failed: string;
    cancelled: string;
    refunded: string;
}

export interface OrdersSearchDictionary {
    placeholder: string;
}

export interface OrdersPaginationDictionary {
    previous: string;
    next: string;
    showing: string;
    of: string;
    results: string;
}

export interface MembershipPlan {
    id: string;
    name: string;
    price: number;
    period: string;
    description: string;
    features: string[];
    current?: boolean;
}

export interface MembershipCurrentPlan {
    title: string;
    description: string;
    freeVersion: string;
    paidVersion: string;
}

export interface MembershipUsage {
    apiCalls: string;
    projectCount: string;
    supportLevel: string;
    remainingThisMonth: string;
    maxLimit: string;
    responseTime: string;
    priority: string;
    standard: string;
}

export interface MembershipUpgradePlan {
    title: string;
    currentPlan: string;
    freeUse: string;
    upgradePlan: string;
}

export interface MembershipBillingHistory {
    title: string;
    description: string;
    pageDescription: string;
    noRecords: string;
    upgradeMessage: string;
    retry: string;
    loading: string;
    loadFailed: string;
    table: {
        date: string;
        description: string;
        amount: string;
        status: string;
        action: string;
        view: string;
    };
    status: {
        pending: string;
        paid: string;
        failed: string;
        cancelled: string;
        refunded: string;
    };
}

export interface MembershipSettingsPageDictionary {
    metadata: {
        title: string;
        description: string;
    };
    header: {
        title: string;
        description: string;
    };
    sections: {
        profile: {
            title: string;
            description: string;
        };
        billing: {
            title: string;
            description: string;
        };
        notifications: {
            title: string;
            description: string;
        };
        security: {
            title: string;
            description: string;
        };
    };
    dangerZone: {
        title: string;
        description: string;
        deleteAccount: string;
    };
}

export interface CancelSubscriptionModalDictionary {
    benefits: {
        title: string;
        description: string;
        periodEndFallback: string;
        items: {
            creditAllowance: {
                title: string;
                description: string;
            };
            premiumModels: {
                title: string;
                description: string;
            };
            commercialLicense: {
                title: string;
                description: string;
            };
        };
        buttons: {
            keep: string;
            continue: string;
        };
    };
    survey: {
        title: string;
        description: string;
        reasons: {
            tooExpensive: string;
            notUsing: string;
            missingFeatures: string;
            foundAlternative: string;
            other: string;
        };
        buttons: {
            back: string;
            continue: string;
        };
    };
    confirm: {
        title: string;
        description: string;
        question: string;
        buttons: {
            no: string;
            yes: string;
        };
    };
    success: {
        title: string;
        description: string;
        resumeHint: string;
        buttons: {
            gotIt: string;
            resume: string;
        };
    };
    errors: {
        cancelFailed: string;
        resumeFailed: string;
        unexpectedError: string;
        noActiveSubscription: string;
        noScheduledCancellation: string;
        providerCancellationFailed: string;
        resumeRequiresScheduledCancellation: string;
        resumeExpiredSubscription: string;
        productInfoNotFound: string;
        previewNotImplemented: string;
        unsupportedProvider: string;
        internalPreviewError: string;
        upgradeRejected: string;
    };
}

export interface MembershipPageComponentDictionary {
    header: {
        title: string;
        subtitle: string;
        manageCreditsTitle: string;
    };
    overviewCards: {
        credits: {
            label: string;
            expires: string;
            button: string;
        };
        plan: {
            label: string;
            button: string;
        };
        usage: {
            label: string;
            creditsUsed: string;
        };
    };
    tabs: {
        credits: string;
        plans: string;
        orders: string;
        usage: string;
    };
    creditsTab: {
        title: string;
        description: string;
        balance: {
            total: string;
            plan: string;
            pack: string;
            bonus: string;
        };
        history: {
            title: string;
            empty: string;
            hint: string;
            descriptions: {
                taskFailedRefunded: string;
                subscriptionCreditsExpired: string;
                subscriptionReactivated: string;
                subscriptionCreditsGranted: string;
                subscriptionRenewalCredits: string;
                subscriptionUpgradeYearlyBonus: string;
                subscriptionUpgradeMonthlyDrip: string;
                subscriptionUpgradeDelta: string;
            };
        };
        breakdown: {
            subscription: {
                label: string;
                source: string;
            };
            purchased: {
                label: string;
                source: string;
            };
            bonus: {
                label: string;
                source: string;
            };
        };
        recharge: {
            title: string;
            placeholder: string;
        };
        appsumo: {
            title: string;
            description: string;
            cta: string;
        };
    };
    plansTab: {
        title: string;
        placeholder: string;
    };
    ordersTab: {
        title: string;
        placeholder: string;
    };
    usageTab: {
        title: string;
        placeholder: string;
    };
}

export interface MembershipSubscriptionPageDictionary {
    emptyState: {
        title: string;
        description: string;
        cta: string;
    };
    status: {
        active: string;
        canceled: string;
    };
    cancelAlert: {
        title: string;
        description: string;
    };
    header: {
        title: string;
        description: string;
    };
    details: {
        nextBillingDate: string;
        accessExpiresOn: string;
        creditsPerPeriod: string;
        interval: {
            month: string;
            year: string;
        };
    };
    actions: {
        pauseHint: string;
        expiringHint: string;
        planChanges: {
            title: string;
            description: string;
            contactPrefix: string;
            contactLink: string;
        };
    };
}

export interface MembershipPageDictionary extends PageDictionary {
    page: MembershipPageComponentDictionary;
    settingsPage: MembershipSettingsPageDictionary;
    currentPlan: MembershipCurrentPlan;
    usage: MembershipUsage;
    upgradePlan: MembershipUpgradePlan;
    billingHistory: MembershipBillingHistory;
    subscriptionPage: MembershipSubscriptionPageDictionary;
    cancelSubscriptionModal: CancelSubscriptionModalDictionary;
    plans: MembershipPlan[];
}

export interface DashboardPageDictionary extends PageDictionary {
    uploadLoading: string;
    transcriptionStarted: string;
    upload: {
        idle: {
            dropzoneTitle: string;
            browseButton: string;
            formatsHint: string;
        };
        link: {
            description: string;
        };
        actions: {
            startTranscription: string;
        };
    };
    list: {
        title: string;
        description: string;
        viewAll: string;
        loading: string;
        error: string;
        openCta: string;
        columns: {
            name: string;
            duration: string;
            created: string;
            status: string;
        };
        actions: {
            menuAria: string;
            share: string;
            export: string;
            rename: string;
            delete: string;
        };
        deleteDialog: {
            title: string;
            description: string;
            confirmButton: string;
            deleting: string;
            cancelButton: string;
            toasts: {
                success: string;
                error: string;
            };
        };
        empty: {
            title: string;
            description: string;
        };
        status: {
            processing: string;
            queued: string;
            preprocessing: string;
            transcribing: string;
            succeeded: string;
            failed: string;
        };
        items: {
            durationUnknown: string;
            languageUnknown: string;
            trimmed: string;
            startedAt: string;
            completedAt: string;
            failedAt: string;
        };
    };
    transcriptions: {
        title: string;
        description: string;
        loading: string;
        error: string;
        search: {
            placeholder: string;
            submit: string;
            clear: string;
        };
        empty: {
            title: string;
            description: string;
            backToDashboard: string;
        };
        searchEmpty: {
            title: string;
            description: string;
        };
        pagination: {
            previous: string;
            next: string;
            pageAria: string;
            showing: string;
        };
    };
}

export interface OrderDetailsDictionary {
    title: string;
    subtitle: string;
    orderInfo: {
        orderNumber: string;
        status: string;
        createdAt: string;
        paidAt: string;
        cancelledAt: string;
        amount: string;
        currency: string;
        paymentProvider: string;
        customerEmail: string;
    };
    productInfo: {
        title: string;
        productName: string;
        productType: string;
        productId: string;
    };
    paymentInfo: {
        title: string;
        provider: string;
        requestId: string;
        sessionId: string;
    };
    customerInfo: {
        title: string;
        email: string;
    };
    orderItems: {
        title: string;
        productName: string;
        description: string;
        unitPrice: string;
        quantity: string;
        totalPrice: string;
    };
    actions: {
        back: string;
        refreshStatus: string;
    };
    status: OrderStatus;
    loading: string;
    error: string;
    retry: string;
    notFound: string;
}

export interface OrdersPageDictionary extends PageDictionary {
    ordersList: OrdersListDictionary;
    orderCard: OrderCardDictionary;
    status: OrderStatus;
    filters: OrdersFiltersDictionary;
    search: OrdersSearchDictionary;
    refresh: string;
    pagination: OrdersPaginationDictionary;
    orderDetails: OrderDetailsDictionary;
}

export interface PaymentSuccessPageDictionary {
    title: string;
    subtitle: string;
    description: string;
    headings: {
        oneTime: string;
        subscription: string;
    };
    badges: {
        oneTime: string;
        subscription: string;
    };
    loading: {
        processing: string;
    };
    errors: {
        generic: string;
        network: string;
        paymentFailed: string;
    };
    order: {
        title: string;
        number: string;
        product: string;
        amount: string;
        paidAt: string;
        status: string;
        paidLabel: string;
    };
    paymentDetails: {
        title: string;
        requestId: string;
        checkoutId: string;
        orderId: string;
        customerId: string;
        productId: string;
    };
    actions: {
        goToDashboard: string;
        viewOrders: string;
        contactSupport: string;
        startUsingTools: string;
        viewMembership: string;
        viewInvoice: string;
        upgradePlan: string;
        startCreating: string;
    };
    features: {
        title: string;
        items: string[];
    };
    quickActionsTitle: string;
    subscription: {
        successTitle: string;
        welcomeTo: string;
        currentCredits: string;
        creditsPerMonth: string;
        creditsPerYear: string;
        nextBillingDate: string;
        nextBilling: string;
        redirectingIn: string;
        seconds: string;
        redirecting: string;
    };
    balance: {
        totalBalance: string;
        readyToCreate: string;
        amountPaid: string;
    };
    toast: {
        paymentSuccessTitle: string;
        creditsAdded: string;
    };
}

export interface PaymentFailedPageDictionary {
    title: string;
    subtitle: string;
    description: string;
    actions: {
        tryAgain: string;
        contactSupport: string;
        goBack: string;
    };
    troubleshooting: {
        title: string;
        items: string[];
    };
    nextStepsTitle: string;
}

export interface PaymentInvoiceDictionary {
    companySubtitle: string;
    title: string;
    invoiceNumber: string;
    date: string;
    status: string;
    paid: string;
    failed: string;
    billedTo: string;
    customerId: string;
    paymentMethod: string;
    servicePeriod: string;
    oneTimePurchase: string;
    description: string;
    amount: string;
    subtotal: string;
    tax: string;
    included: string;
    total: string;
    thankYou: string;
    supportText: string;
    generatedOn: string;
    downloadTitle: string;
    generationFailed: string;
    fileNamePrefix: string;
}

export interface PaymentPageDictionary {
    success: PaymentSuccessPageDictionary;
    failed: PaymentFailedPageDictionary;
    invoice: PaymentInvoiceDictionary;
}

export interface CheckoutResumePageDictionary extends PageDictionary {
    errorTitle: string;
    actions: {
        tryAgain: string;
        back: string;
    };
    errors: {
        missingContext: string;
        createCheckoutFailed: string;
    };
}

export interface BlogsPageDictionary extends PageDictionary {
    heading: string;
    readMore: string;
    postedOn: string;
    noBlogPosts: string;
    backToBlog: string;
    readingTime: string;
    relatedPosts: string;
    tagsLabel: string;
    cta: {
        title: string;
        description: string;
        button: string;
    };
    mp3TranscriptionCta: {
        title: string;
        description: string;
        button: string;
    };
    podcastContentCta: {
        title: string;
        description: string;
        button: string;
    };
}

export interface AdminBlogEditDictionary {
    title: string;
    subtitle: string;
    back: string;
    form: {
        language: string;
        languageOptions: {
            zh: string;
            en: string;
            ja: string;
        };
        title: string;
        slug: string;
        description: string;
        content: string;
        tags: string;
        status: string;
        visibility: string;
        featured: string;
        featuredDescription: string;
        generateSlug: string;
        slugHelper: string;
        titleHelper: string;
        descriptionHelper: string;
    };
    actions: {
        cancel: string;
        update: string;
        create: string;
    };
    status: {
        draft: string;
        published: string;
    };
    visibility: {
        public: string;
        private: string;
        subscribers: string;
    };
}

export interface AdminBlogsDictionary extends PageDictionary {
    list: {
        title: string;
        subtitle: string;
        noBlogs: string;
        createNew: string;
    };
    table: {
        title: string;
        author: string;
        status: string;
        visibility: string;
        featured: string;
        featuredCheck: string;
        createdAt: string;
        actions: string;
        edit: string;
        delete: string;
    };
    edit: AdminBlogEditDictionary;
}

export interface RedeemPageDictionary extends PageDictionary {
    metadataTitle: string;
    metadataDescription: string;
    form: {
        codeLabel: string;
        codePlaceholder: string;
        submit: string;
        submitGuest: string;
        submitting: string;
    };
    footnote: string;
    progress: string;
    stackLimitReached: string;
    auth: {
        createAccount: string;
    };
    success: {
        title: string;
        balance: string;
        cta: string;
        redeemAnother: string;
    };
    errors: {
        emptyCode: string;
        invalidCode: string;
        alreadyRedeemed: string;
        revoked: string;
        stackLimit: string;
        rateLimited: string;
        generic: string;
    };
}

export interface LinksPageDictionary extends PageDictionary {
    badgesHeading: string;
    badgesAriaLabel: string;
    partnerLinksHeading: string;
    partnerLinksAriaLabel: string;
    badgeItems: Record<
        string,
        {
            logoAlt: string;
            brandLabel: string;
            titleLabel: string;
        }
    >;
    partnerLinkItems: Record<
        string,
        {
            label: string;
            linkTitle: string;
        }
    >;
    notice: string;
}

export interface PagesDictionary {
    features: FeaturesPageDictionary;
    pricing: PricingPageDictionary;
    docs: DocsPageDictionary;
    integrations: IntegrationsPageDictionary;
    help: HelpPageDictionary;
    contact: ContactPageDictionary;
    status: StatusPageDictionary;
    privacy: PrivacyPageDictionary;
    audioRecorderPrivacy: PrivacyPageDictionary;
    terms: TermsPageDictionary;
    cookies: CookiesPageDictionary;
    login: PageDictionary;
    signup: PageDictionary;
    redeem: RedeemPageDictionary;
    dashboard: DashboardPageDictionary;
    profile: ProfilePageDictionary;
    membership: MembershipPageDictionary;
    orders: OrdersPageDictionary;
    payment: PaymentPageDictionary;
    checkoutResume: CheckoutResumePageDictionary;
    transcriptions: TranscriptionsPageDictionary;
    blogs: BlogsPageDictionary;
    links: LinksPageDictionary;
    adminBlogs: AdminBlogsDictionary;
}

export interface MigrationFailedDictionary {
    title: string;
    description: string;
    expiryNotice: string;
    duration: string;
    suggestion: string;
}

export interface TasksDictionary {
    viewMoreInMyCreations: string;
    endOfCreations: string;
    loadingMore: string;
    batch: {
        addedToFavorites: string;
        removedFromFavorites: string;
        deletedSuccess: string;
        downloadStarted: string;
    };
    copyTaskId: string;
    copySuccess: string;
    copyError: string;
    copied: string;
    deleteTask: string;
    deleteSuccess: string;
    deleteError: string;
    delete: string;
    deleting: string;
    cancel: string;
    deletePendingTitle: string;
    deletePendingDesc: string;
    deleteCompletedTitle: string;
    deleteCompletedDesc: string;
    deleteFailedTitle: string;
    deleteFailedDesc: string;
    migrationFailed: MigrationFailedDictionary;
    taskCard: {
        brandName: string;
        elapsedTime: string;
        delete: string;
        reprompt: string;
        showMore: string;
        showLess: string;
    };
    navigation: {
        record: string;
        inspiration: string;
        all: string;
        videos: string;
        images: string;
        favorites: string;
        myCreations: string;
    };
    inspirationsGrid: {
        noInspirationsYet: string;
        checkBackLater: string;
        retry: string;
    };
    imageLightbox: {
        imagePreview: string;
        close: string;
    };
    playerModal: {
        title: string;
        publishFailed: string;
        originalImage: string;
        prompt: string;
        noPrompt: string;
        technicalSpecs: {
            title: string;
            model: string;
            duration: string;
            seed: string;
            audio: string;
            audioEnabled: string;
            audioDisabled: string;
            publicVisibility: string;
            publicVisibilityPrivate: string;         // 私有
            publicVisibilityPendingReview: string;   // 审核?
            publicVisibilityPublished: string;       // 已公开
            publicVisibilityRejected: string;        // 审核拒绝
            outputDimension: string;
            createdIn: string;
            defaultProject: string;
            auto: string;
            defaultSeed: string;
            defaultResolution: string;
            defaultDuration: string;
            defaultModel: string;
            unknown: string;
        };
        imagePreviewAlt: string;
        actions: {
            createSimilar: string;
            favorite: string;
            share: string;
            download: string;
            more: string;
            retryCreation: string;
            tryAgain: string;
        };
        generationFailed: string;
        sensitiveContentDetected: string;
        generating: string;
        migrationNotice: string;
        deleteDialog: {
            title: string;
            description: string;
            cancel: string;
            confirm: string;
            deleting: string;
        };
    };
    imagePlayerModal: {
        title: string;
        originalImage: string;
        prompt: string;
        noPrompt: string;
        technicalSpecs: {
            model: string;
            seed: string;
            outputDimension: string;
            unknown: string;
            publicVisibilityPrivate: string;
            publicVisibilityPendingReview: string;
            publicVisibilityPublished: string;
            publicVisibilityRejected: string;
        };
        actions: {
            createSimilar: string;
            favorite: string;
            share: string;
            download: string;
            more: string;
        };
    };
}

export interface LandingDictionary {
    hero: {
        title: string;
        descriptionHtml: string;
        upload: {
            idleTitle: string;
            idleDescription: string;
            selectedTitle: string;
            selectedDescription: string;
            supportHint: string;
            tabs: {
                upload: string;
                link: string;
            };
            idle: {
                dropzoneTitle: string;
                or: string;
                uploadButton: string;
                formatsAudio: string;
                formatsVideo: string;
            };
            selected: {
                removeFileAria: string;
                fileMetaSeparator: string;
            };
            settings: {
                audioLanguage: {
                    label: string;
                    hint: string;
                    searchPlaceholder: string;
                    noResults: string;
                    languages: Array<{
                        id: string;
                        label: string;
                        nativeLabel: string;
                    }>;
                };
                generateSubtitle: {
                    label: string;
                    tooltip: string;
                };
                speakerIdentification: {
                    label: string;
                    badge: string;
                    tooltip: string;
                };
                aiSummary: {
                    label: string;
                    tooltip: string;
                    options: {
                        off: string;
                        general: string;
                    };
                };
                aiMindMap: {
                    label: string;
                    tooltip: string;
                    options: {
                        off: string;
                        general: string;
                    };
                };
            };
            status: {
                ready: string;
                reading: string;
            };
            labels: {
                fileName: string;
                duration: string;
                sourceType: string;
            };
            sourceTypes: {
                audio: string;
                video: string;
            };
                    actions: {
                        selectFile: string;
                        replaceFile: string;
                        changeFile: string;
                        start: string;
                        starting: string;
                        uploadingProgress: string;
                        startingTranscription: string;
                        transcribeForFree: string;
                    };
            link: {
                description: string;
                platformsLabel: string;
                placeholder: string;
                searchButton: string;
                searchingButton: string;
                previewThumbnailAlt: string;
                errors: {
                    resolveFailed: string;
                };
                platforms: {
                    youtube: string;
                    tiktok: string;
                    instagram: string;
                    facebook: string;
                    x: string;
                    manyOther: string;
                };
            };
            footer: {
                termsPrefix: string;
                termsLink: string;
                termsAnd: string;
                privacyLink: string;
            };
            errors: {
                unsupportedType: string;
                audioTooLarge: string;
                videoTooLarge: string;
                fileTooLarge: string;
                prepareFailed: string;
                uploadFailed: string;
                createFailed: string;
            };
        };
    };
    whyChooseUs: {
        title: string;
        subtitle: string;
        items: FeatureItem[];
    };
    transcriptExample: {
        title: string;
        previewLabel: string;
        ctaText: string;
        intro: string[];
        lines: TranscriptExampleLine[];
        closing: string;
    };
    faq: {
        title: string;
        items: FAQItem[];
    };
    howToUse: {
        title: string;
        subtitle?: string;
        ctaText?: string;
        steps: Array<{
            title: string;
            description: string;
        }>;
    };
    useCases: {
        title: string;
        descriptionHtml: string;
        ctaText: string;
        items: UseCaseShowcaseItem[];
    };
    finalCta: {
        title: string;
        subtitle: string;
        button: string;
    };
    productCards: {
        title: string;
        items: {
            mp3ToSrt: {
                label: string;
            };
            m4aToText: {
                label: string;
            };
        };
    };
}

export type Mp3ToSrtLandingDictionary = Omit<LandingDictionary, "transcriptExample"> & {
    srtExample: SrtExampleDictionary;
};

export interface MarketingDictionary {
    landing: LandingDictionary;
    mp3ToSrt: Mp3ToSrtLandingDictionary;
    m4aToText: LandingDictionary;
}

export interface AuthDictionary {
    emailAddressLabel: string;
    welcomeBack: string;
}

export interface CreationCardDictionary {
    processing: string;
    delete: string;
}

export interface MyCreationsPageDictionary {
    title: string;
    favorites: string;
    select: string;
    itemsSelected: string;
    delete: string;
    download: string;
    addToFavorites: string;
    cancel: string;
}

export interface WorkspaceDictionary {
    creationCard: CreationCardDictionary;
    myCreationsPage: MyCreationsPageDictionary;
}

export interface AppEmailCommonHeaderDictionary {
    logo: string;
    subheader: string;
}

export interface AppEmailCommonFooterDictionary {
    rightsReserved: string;
    termsOfService: string;
    privacyPolicy: string;
    helpPrefix: string;
    contactSupport: string;
}

export interface AppEmailCommonDictionary {
    header: AppEmailCommonHeaderDictionary;
    footer: AppEmailCommonFooterDictionary;
}

export interface AppEmailMagicLinkDictionary {
    subject: string;
    preview: string;
    title: string;
    greeting: string;
    requestPrefix: string;
    requestSuffix: string;
    button: string;
    copyLink: string;
    warningPrefix: string;
    warningDuration: string;
    warningSuffix: string;
    ignoreNotice: string;
    senderName: string;
}

export interface AppEmailDictionary {
    common: AppEmailCommonDictionary;
    magicLink: AppEmailMagicLinkDictionary;
}

export interface ErrorPagesDictionary {
    notFound: {
        title: string;
        heading: string;
        description: string;
        backHome: string;
        tryTools: string;
    };
    error: {
        title: string;
        heading: string;
        description: string;
        retry: string;
        backHome: string;
    };
}

export interface AppNamespaceDictionary {
    payments: {
        history: { label: { receipt: string; charged: string; tax: string; refunded: string; unconfirmed: string } };
        checkout: { error: { unavailable: string; provider: string; existingSubscription: string } };
        subscription: { plan: { tier1_monthly: string; tier1_yearly: string; tier2_monthly: string; tier2_yearly: string; tier3_monthly: string; tier3_yearly: string }; error: { resume: string; plan: string; change: string }; action: { portal: string; confirm: string; change: string; cancelChange: string; cancelWarning: string } };
        status: { message: { pending: string; review: string; failed: string; confirmed: string; scheduled: string } };
    };
    email: AppEmailDictionary;
}

export interface AdminDictionary {
    sidebar: {
        title: string;
        subtitle: string;
        copyright: string;
        nav: {
            overview: {
                label: string;
            };
            users: {
                label: string;
            };
            transcriptions: {
                label: string;
            };
            orders: {
                label: string;
            };
            subscriptions: {
                label: string;
            };
            contactMessages: {
                label: string;
            };
            system: {
                label: string;
            };
        };
    };
    header: {
        profile: string;
        logout: string;
        viewSite: string;
    };
    videoEffects: {
        nav: {
            item: {
                label: string;
            };
        };
        page: {
            header: {
                title: string;
                subtitle: string;
            };
            tab: {
                group: string;
                template: string;
            };
        };
        action: {
            group: {
                create: string;
                update: string;
                delete: string;
            };
            template: {
                create: string;
                update: string;
                delete: string;
            };
            form: {
                save: string;
                cancel: string;
            };
            bulk: {
                status: string;
                apply: string;
            };
            upload: {
                video: string;
                image: string;
            };
        };
        field: {
            group: {
                slug: string;
                nameKey: string;
                displayTitle: string;
                displayDescription: string;
                description: string;
                sortOrder: string;
                status: string;
                type: string;
            };
            template: {
                slug: string;
                groupId: string;
                nameKey: string;
                displayName: string;
                displayDescription: string;
                modelName: string;
                modelVersion: string;
                generationType: string;
                effectType: string;
                prompt: string;
                negativePrompt: string;
                templateParams: string;
                creditsOverride: string;
                inputImageCount: string;
                duration: string;
                resolution: string;
                sortOrder: string;
                status: string;
                templateVideoUrl: string;
                thumbnailUrl: string;
                seoTitle: string;
                seoDescription: string;
                seoBlocks: string;
                seoTitleKey: string;
                seoDescriptionKey: string;
                seoBlocksKey: string;
            };
        };
        helper: {
            group: {
                slug: string;
                displayTitle: string;
                displayDescription: string;
            };
            template: {
                slug: string;
                displayName: string;
                displayDescription: string;
                templateParams: string;
                creditsOverride: string;
            };
        };
        option: {
            generationType: Record<string, string>;
            resolution: Record<string, string>;
            effectType: Record<string, string>;
            inputImageCount: {
                one: string;
                two: string;
            };
        };
        table: {
            group: {
                slug: string;
                nameKey: string;
                description: string;
                sortOrder: string;
                status: string;
                actions: string;
            };
            template: {
                slug: string;
                nameKey: string;
                group: string;
                sortOrder: string;
                status: string;
                actions: string;
            };
        };
        status: {
            draft: {
                label: string;
            };
            active: {
                label: string;
            };
            hidden: {
                label: string;
            };
        };
        empty: {
            group: {
                text: string;
            };
            template: {
                text: string;
            };
        };
        message: {
            delete: {
                group: string;
                template: string;
            };
            upload: {
                failed: string;
            };
            json: {
                invalid: string;
            };
            form: {
                invalid: string;
            };
        };
    };
}

export interface AppDictionary {
    authPanel: AuthPanelDictionary;
    header: HeaderDictionary;
    footer: FooterDictionary;
    component: ComponentDictionary;
    page: PageI18nDictionary;
    tools: ToolsDictionary;
    pages: PagesDictionary;
    tasks: TasksDictionary;
    workspace: WorkspaceDictionary;
    marketing: MarketingDictionary;
    errorPages: ErrorPagesDictionary;
    app: AppNamespaceDictionary;
    admin: AdminDictionary;
    auth: AuthDictionary;
}

export type PartialAppDictionary = DeepPartial<AppDictionary>;
