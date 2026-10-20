/**
 * 经过行业研究和验证的高质量Prompt模板
 * 基于 Runway Gen-3, Pika, Kling AI 最佳实践
 * 更新日期: 2025-12
 */

export const VERIFIED_TEMPLATES = {
  // ========== 运动特效类 ==========
  motion: [
    {
      name: "Cinematic Zoom In",
      slug: "cinematic-zoom",
      description: "Professional cinematic zoom effect with dramatic reveal",
      promptTemplate: "Slow dolly zoom in on {subject}, dramatic reveal, cinematic lighting with soft shadows, shallow depth of field, subtle film grain, 24fps movie quality",
      tags: ["cinematic", "zoom", "dramatic", "professional"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.7
      },
      creditsCost: 15,
      usageNotes: "最佳用于人像特写或产品展示。确保主体在画面中心。",
      exampleResult: "平滑的推进镜头，逐渐聚焦到主体细节"
    },

    {
      name: "Ethereal Slow Motion",
      slug: "slow-motion",
      description: "Beautiful ultra slow motion with dreamy atmosphere",
      promptTemplate: "Ultra slow motion footage of {subject}, hair and fabric flowing gently in wind, soft golden hour lighting, dreamy ethereal atmosphere, floating particles catching light",
      tags: ["slow-motion", "ethereal", "dreamy", "elegant"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.3
      },
      creditsCost: 10,
      usageNotes: "需要有可流动的元素（头发、衣物、水流）效果最佳",
      exampleResult: "慢动作展现细节动态，营造梦幻氛围"
    },

    {
      name: "FPV Hyperspeed Flight",
      slug: "fpv-hyperspeed",
      description: "High-energy first-person view racing footage",
      promptTemplate: "Continuous hyperspeed FPV footage: Camera flies dynamically through and around {subject}, motion blur, rapid perspective changes, adrenaline-pumping energy, smooth stabilization",
      tags: ["fpv", "fast", "dynamic", "exciting"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.9
      },
      creditsCost: 20,
      usageNotes: "需要场景有深度层次。避免平面图像。",
      exampleResult: "高速穿越镜头，动感十足"
    },

    {
      name: "360° Product Orbit",
      slug: "orbit-360",
      description: "Premium 360-degree rotation for products and subjects",
      promptTemplate: "Smooth 360 degree orbit shot around {subject}, camera maintains perfect focus, dramatic studio lighting from multiple angles, professional commercial quality, seamless loop",
      tags: ["orbit", "360", "product", "commercial"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.6
      },
      creditsCost: 18,
      usageNotes: "产品展示、电商视频、人物介绍的理想选择",
      exampleResult: "完整环绕主体，展示所有角度"
    },

    {
      name: "Smooth Tracking Shot",
      slug: "tracking-shot",
      description: "Professional tracking camera following subject",
      promptTemplate: "Smooth tracking shot following {subject}, steadicam movement, cinematic framing, natural motion, professional production quality",
      tags: ["tracking", "follow", "cinematic"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.5
      },
      creditsCost: 12,
      usageNotes: "适合展示运动中的主体",
      exampleResult: "流畅跟拍，保持主体在画面中"
    }
  ],

  // ========== 风格转换类 ==========
  styleTransfer: [
    {
      name: "Studio Ghibli Anime",
      slug: "anime-ghibli",
      description: "Transform into beautiful Studio Ghibli anime style",
      promptTemplate: "Anime style video of {subject}, Studio Ghibli aesthetic, vibrant watercolor colors, hand-drawn quality, cel-shaded lighting, expressive fluid motion, whimsical atmosphere",
      tags: ["anime", "ghibli", "artistic", "colorful"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.5
      },
      creditsCost: 15,
      usageNotes: "人物和自然场景效果最佳",
      exampleResult: "动漫风格转换，保持原始构图"
    },

    {
      name: "Impressionist Oil Painting",
      slug: "oil-painting",
      description: "Classic impressionist oil painting animation",
      promptTemplate: "Impressionist oil painting style of {subject}, visible thick brushstrokes, rich impasto texture, warm color palette, Van Gogh inspired, painterly motion, artistic masterpiece quality",
      tags: ["oil-painting", "impressionist", "artistic", "classical"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.4
      },
      creditsCost: 15,
      usageNotes: "风景和肖像效果出色",
      exampleResult: "油画质感动画，充满艺术气息"
    },

    {
      name: "Cyberpunk Neon City",
      slug: "cyberpunk-neon",
      description: "Futuristic cyberpunk style with neon lights",
      promptTemplate: "Cyberpunk style video of {subject}, neon lights reflecting on wet surfaces, holographic effects, futuristic atmosphere, rain-slicked aesthetic, Blade Runner inspired, high contrast colors",
      tags: ["cyberpunk", "neon", "futuristic", "sci-fi"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.6
      },
      creditsCost: 18,
      usageNotes: "城市场景或科技主题最佳",
      exampleResult: "赛博朋克霓虹风格转换"
    },

    {
      name: "Watercolor Dream",
      slug: "watercolor",
      description: "Soft watercolor painting style",
      promptTemplate: "Watercolor painting style of {subject}, soft color bleeds, paper texture, delicate washes, pastel tones, gentle artistic motion, ethereal quality",
      tags: ["watercolor", "soft", "artistic", "gentle"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.3
      },
      creditsCost: 12,
      usageNotes: "适合柔和主题和肖像",
      exampleResult: "水彩画风格，柔和梦幻"
    }
  ],

  // ========== 人像特效类 ==========
  portrait: [
    {
      name: "Film Noir Dramatic",
      slug: "film-noir",
      description: "Classic film noir style with dramatic shadows",
      promptTemplate: "Dramatic close-up shot of {subject}, high contrast chiaroscuro lighting, deep noir shadows, film grain texture, intense emotion, black and white aesthetic, 1940s cinema quality",
      tags: ["portrait", "dramatic", "noir", "vintage"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "9:16",
        motionScale: 0.3
      },
      creditsCost: 15,
      usageNotes: "人物肖像特写效果最佳",
      exampleResult: "黑白电影质感，戏剧化光影"
    },

    {
      name: "Ethereal Portrait Glow",
      slug: "portrait-glow",
      description: "Angelic glow effect for portraits",
      promptTemplate: "Portrait of {subject} with soft ethereal glow, gentle backlit rim light, dreamy bokeh background, golden light particles floating, angelic atmosphere, soft focus beauty lighting",
      tags: ["portrait", "glow", "ethereal", "beauty"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "9:16",
        motionScale: 0.3
      },
      creditsCost: 12,
      usageNotes: "婚礼、时尚、美妆类视频理想选择",
      exampleResult: "柔和光晕，天使般效果"
    },

    {
      name: "Fashion Runway Walk",
      slug: "fashion-runway",
      description: "High-fashion runway style video",
      promptTemplate: "Slow motion fashion video of {subject} walking confidently, wind machine effect on hair and clothes, dramatic rim lighting, high-end editorial quality, Vogue magazine aesthetic, professional model energy",
      tags: ["fashion", "runway", "commercial", "editorial"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "9:16",
        motionScale: 0.4
      },
      creditsCost: 18,
      usageNotes: "时尚品牌、电商展示",
      exampleResult: "时尚大片感，专业模特走秀"
    },

    {
      name: "Candid Moment Capture",
      slug: "candid-moment",
      description: "Natural candid moment with emotion",
      promptTemplate: "Candid shot of {subject}, natural lighting, genuine emotion, subtle camera movement, documentary style, authentic moment, soft color grading",
      tags: ["portrait", "candid", "natural", "emotion"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.4
      },
      creditsCost: 10,
      usageNotes: "适合真实情感表达",
      exampleResult: "自然抓拍瞬间，真实感强"
    }
  ],

  // ========== 自然/天气类 ==========
  nature: [
    {
      name: "Gentle Breeze Effect",
      slug: "gentle-wind",
      description: "Soft wind effect with natural movement",
      promptTemplate: "Video of {subject} with gentle breeze, hair and clothes flowing naturally in wind, outdoor golden hour lighting, soft atmospheric movement, peaceful serene vibe, nature sounds implied",
      tags: ["wind", "nature", "gentle", "outdoor"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.5
      },
      creditsCost: 10,
      usageNotes: "户外场景，需要有可流动元素",
      exampleResult: "自然微风拂过，轻盈动感"
    },

    {
      name: "Winter Snowfall Magic",
      slug: "snowfall",
      description: "Beautiful falling snow effect",
      promptTemplate: "Video of {subject} with soft snowflakes falling gently, winter wonderland atmosphere, cold blue color grading, bokeh snow particles catching light, magical festive quality, peaceful mood",
      tags: ["snow", "winter", "magical", "festive"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.5
      },
      creditsCost: 12,
      usageNotes: "节日主题、冬季活动",
      exampleResult: "飘雪效果，冬日氛围"
    },

    {
      name: "Dramatic Storm Rain",
      slug: "rain-storm",
      description: "Heavy rain with moody atmosphere",
      promptTemplate: "Video of {subject} in dramatic rain, heavy water droplets visible, moody overcast atmosphere, storm lighting with flashes, cinematic weather effect, intense mood, rain streaks on lens",
      tags: ["rain", "moody", "dramatic", "storm"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.7
      },
      creditsCost: 15,
      usageNotes: "戏剧化场景，情绪渲染",
      exampleResult: "暴雨效果，氛围感强"
    },

    {
      name: "Golden Hour Sunrise",
      slug: "golden-sunrise",
      description: "Warm golden hour glow",
      promptTemplate: "Video of {subject} during golden hour sunrise, warm orange and pink glow, beautiful lens flare, magical atmosphere, god rays piercing through atmosphere, hopeful uplifting mood",
      tags: ["sunrise", "golden-hour", "warm", "uplifting"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.4
      },
      creditsCost: 12,
      usageNotes: "户外场景，积极正面主题",
      exampleResult: "金色日出，温暖光晕"
    },

    {
      name: "Cherry Blossom Breeze",
      slug: "cherry-blossom",
      description: "Romantic cherry blossom petals floating",
      promptTemplate: "Video of {subject} with cherry blossom petals gently floating and swirling in breeze, soft pink color palette, romantic spring atmosphere, dreamy bokeh, peaceful Japanese garden aesthetic",
      tags: ["nature", "spring", "romantic", "peaceful"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.5
      },
      creditsCost: 15,
      usageNotes: "春季主题、浪漫场景",
      exampleResult: "樱花飘落，浪漫唯美"
    }
  ],

  // ========== 创意特效类 ==========
  creative: [
    {
      name: "Glitch Digital Effect",
      slug: "glitch-digital",
      description: "Modern digital glitch effect",
      promptTemplate: "Video of {subject} with digital glitch effects, RGB color separation, scan lines, data corruption aesthetic, modern tech style, cyberpunk undertones",
      tags: ["glitch", "digital", "modern", "tech"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.6
      },
      creditsCost: 15,
      usageNotes: "科技、游戏、潮流主题",
      exampleResult: "数字故障风格，科技感"
    },

    {
      name: "Vintage Film Look",
      slug: "vintage-film",
      description: "Classic vintage film aesthetic",
      promptTemplate: "Video of {subject} with vintage 8mm film look, warm faded colors, film grain and dust, light leaks, nostalgic 1970s aesthetic, home movie quality",
      tags: ["vintage", "retro", "nostalgic", "film"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "4:3",
        motionScale: 0.4
      },
      creditsCost: 12,
      usageNotes: "怀旧主题、复古风格",
      exampleResult: "复古胶片质感，怀旧氛围"
    },

    {
      name: "Particle Explosion",
      slug: "particle-explosion",
      description: "Dynamic particle dispersion effect",
      promptTemplate: "Video of {subject} dispersing into colorful particles, dynamic energy, particles flowing and swirling, magical transformation, vibrant colors, Disney Pixar style magic effect",
      tags: ["particles", "magic", "dynamic", "colorful"],
      defaultParameters: {
        duration: 5,
        aspectRatio: "16:9",
        motionScale: 0.8
      },
      creditsCost: 20,
      usageNotes: "创意广告、特效展示",
      exampleResult: "粒子爆炸消散效果"
    }
  ]
};

/**
 * 获取指定分类的所有模板
 */
export function getTemplatesByCategory(category: keyof typeof VERIFIED_TEMPLATES) {
  return VERIFIED_TEMPLATES[category];
}

/**
 * 获取所有模板（扁平化）
 */
export function getAllTemplates() {
  return Object.values(VERIFIED_TEMPLATES).flat();
}

/**
 * 替换Prompt中的占位符
 */
export function fillPromptTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  });
  return result;
}

/**
 * 验证Prompt模板质量
 */
export function validatePromptTemplate(prompt: string): {
  isValid: boolean;
  issues: string[];
  score: number;
} {
  const issues: string[] = [];
  let score = 100;

  // 长度检查
  if (prompt.length > 250) {
    issues.push("Prompt过长（建议<200字符）");
    score -= 20;
  }

  // 必需元素检查
  const hasSubject = prompt.includes("{subject}");
  const hasCameraOrAction = /camera|shot|motion|zoom|pan|orbit|tracking/i.test(prompt);
  const hasStyle = /cinematic|dramatic|ethereal|style|aesthetic|quality/i.test(prompt);

  if (!hasSubject) {
    issues.push("缺少{subject}占位符");
    score -= 30;
  }
  if (!hasCameraOrAction) {
    issues.push("建议添加相机运动或动作描述");
    score -= 20;
  }
  if (!hasStyle) {
    issues.push("建议添加风格或氛围描述");
    score -= 15;
  }

  // 否定词检查
  const negativeWords = /no |don't|without|avoid/i;
  if (negativeWords.test(prompt)) {
    issues.push("避免使用否定词（'no clouds' → 'clear sky'）");
    score -= 10;
  }

  return {
    isValid: score >= 60,
    issues,
    score: Math.max(0, score)
  };
}
