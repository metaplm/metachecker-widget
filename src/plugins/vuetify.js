import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";

// MetaPLM kurumsal renk paleti
const metaplm = {
    dark: false,
    colors: {
        background: "#FFFFFF",
        surface: "#FFFFFF",
        primary: "#015686", // kurumsal mavi
        secondary: "#1F93CE", // accent
        accent: "#1F93CE",
        error: "#C62828",
        info: "#1F93CE",
        success: "#2E7D32",
        warning: "#EF6C00",
        // severity tonları (severity-<x> ile kullanılabilir)
        "severity-critical": "#C62828",
        "severity-major": "#EF6C00",
        "severity-minor": "#1F93CE",
        "severity-info": "#757575"
    }
};

export default createVuetify({
    components,
    directives,
    theme: {
        defaultTheme: "metaplm",
        themes: { metaplm }
    },
    icons: {
        defaultSet: "mdi"
    }
});
