/**
 * AERIS Atmospheric Theme Engine
 * ────────────────────────────────────────────────────────────────
 * Maps environmental data (AQI, Risk) to visual design tokens.
 */

export const getAtmosphereTheme = (aqi, riskLevel = 'Low Risk') => {
  let mode = "clean";
  
  if (aqi <= 50) {
    mode = "clean";
  } else if (aqi <= 100) {
    mode = "moderate";
  } else if (aqi <= 150) {
    mode = "unhealthy";
  } else {
    mode = "hazard";
  }

  const themes = {
    clean: {
      mode: "clean",
      backgroundGradient: "linear-gradient(180deg, #EAF7FB 0%, #D8F0F7 100%)",
      cardBackground: "rgba(255, 255, 255, 0.65)",
      textPrimary: "#1F2933",
      textSecondary: "#475569",
      glowColor: "rgba(34, 211, 238, 0.3)",
      hazeOverlay: "radial-gradient(circle, rgba(167, 243, 208, 0.1) 0%, transparent 70%)",
      sectionSpacing: "32px",
      cardShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
      chartTokens: {
        line: "#0ea5e9",
        area: "rgba(14, 165, 233, 0.2)",
        grid: "rgba(203, 213, 225, 0.4)",
        text: "#475569",
        thickness: 3
      }
    },
    moderate: {
      mode: "moderate",
      backgroundGradient: "linear-gradient(180deg, #F4F9FC 0%, #E7EEF4 100%)",
      cardBackground: "rgba(255, 255, 255, 0.55)",
      textPrimary: "#1F2933",
      textSecondary: "#475569",
      glowColor: "rgba(251, 191, 36, 0.3)",
      hazeOverlay: "radial-gradient(circle, rgba(251, 191, 36, 0.08) 0%, transparent 70%)",
      sectionSpacing: "24px",
      cardShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
      chartTokens: {
        line: "#f59e0b",
        area: "rgba(245, 158, 11, 0.2)",
        grid: "rgba(203, 213, 225, 0.4)",
        text: "#475569",
        thickness: 3
      }
    },
    unhealthy: {
      mode: "unhealthy",
      backgroundGradient: "linear-gradient(180deg, #0F2533 0%, #0A1D28 100%)",
      cardBackground: "rgba(15, 37, 51, 0.55)",
      textPrimary: "#E6EEF3",
      textSecondary: "#94a3b8",
      glowColor: "rgba(249, 115, 22, 0.4)",
      hazeOverlay: "rgba(15, 37, 51, 0.25)",
      sectionSpacing: "20px",
      cardShadow: "0 8px 30px rgba(0, 0, 0, 0.2)",
      chartTokens: {
        line: "#f97316",
        area: "rgba(249, 115, 22, 0.15)",
        grid: "rgba(255, 255, 255, 0.05)",
        text: "#94a3b8",
        thickness: 4
      }
    },
    hazard: {
      mode: "hazard",
      backgroundGradient: "linear-gradient(180deg, #081A24 0%, #050F16 100%)",
      cardBackground: "rgba(8, 26, 36, 0.65)",
      textPrimary: "#E6EEF3",
      textSecondary: "#94a3b8",
      glowColor: "rgba(239, 68, 68, 0.5)",
      hazeOverlay: "radial-gradient(circle, rgba(239, 68, 68, 0.07) 0%, rgba(5, 15, 22, 0.3) 100%)",
      sectionSpacing: "16px",
      cardShadow: "0 12px 40px rgba(0, 0, 0, 0.3)",
      chartTokens: {
        line: "#ef4444",
        area: "rgba(239, 68, 68, 0.2)",
        grid: "rgba(255, 255, 255, 0.08)",
        text: "#94a3b8",
        thickness: 5
      }
    }
  };

  return themes[mode];
};
