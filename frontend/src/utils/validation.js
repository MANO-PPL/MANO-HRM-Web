export const COUNTRIES = [
    { name: "India", code: "IN", dial_code: "+91", flag: "🇮🇳", pattern: /^[6-9]\d{9}$/, length: 10, placeholder: "98765 43210" },
    { name: "United States", code: "US", dial_code: "+1", flag: "🇺🇸", pattern: /^\d{10}$/, length: 10, placeholder: "201 555 0123" },
    { name: "Canada", code: "CA", dial_code: "+1", flag: "🇨🇦", pattern: /^\d{10}$/, length: 10, placeholder: "613 555 0142" },
    { name: "United Kingdom", code: "GB", dial_code: "+44", flag: "🇬🇧", pattern: /^[7-9]\d{9}$/, length: 10, placeholder: "7911 123456" },
    { name: "Australia", code: "AU", dial_code: "+61", flag: "🇦🇺", pattern: /^\d{9}$/, length: 9, placeholder: "412 345 678" },
    { name: "Singapore", code: "SG", dial_code: "+65", flag: "🇸🇬", pattern: /^[89]\d{7}$/, length: 8, placeholder: "8123 4567" },
    { name: "United Arab Emirates", code: "AE", dial_code: "+971", flag: "🇦🇪", pattern: /^5\d{8}$/, length: 9, placeholder: "50 123 4567" },
    { name: "Saudi Arabia", code: "SA", dial_code: "+966", flag: "🇸🇦", pattern: /^5\d{8}$/, length: 9, placeholder: "50 123 4567" },
    { name: "Germany", code: "DE", dial_code: "+49", flag: "🇩🇪", pattern: /^\d{10,11}$/, length: 10, placeholder: "151 23456789" },
    { name: "France", code: "FR", dial_code: "+33", flag: "🇫🇷", pattern: /^\d{9}$/, length: 9, placeholder: "6 1234 5678" },
    { name: "Malaysia", code: "MY", dial_code: "+60", flag: "🇲🇾", pattern: /^1\d{8,9}$/, length: 10, placeholder: "12 345 6789" },
    { name: "Generic / Other", code: "OTHER", dial_code: "+", flag: "🌐", pattern: /^\d{4,15}$/, length: 15, placeholder: "Enter phone number" }
];

export const parsePhoneNumber = (phoneStr) => {
    if (!phoneStr) return { country: COUNTRIES[0], localNumber: "" };
    const cleaned = phoneStr.trim();
    
    // Sort by dial code length descending
    const sortedCountries = [...COUNTRIES].filter(c => c.dial_code !== "+").sort((a, b) => b.dial_code.length - a.dial_code.length);
    for (const country of sortedCountries) {
        if (cleaned.startsWith(country.dial_code)) {
            return {
                country,
                localNumber: cleaned.slice(country.dial_code.length)
            };
        }
    }
    
    if (cleaned.startsWith("+")) {
        return {
            country: COUNTRIES.find(c => c.code === "OTHER"),
            localNumber: cleaned.slice(1)
        };
    }
    
    // Default fallback: India
    return {
        country: COUNTRIES[0],
        localNumber: cleaned
    };
};

export const validatePhone = (phoneStr) => {
    if (!phoneStr) return false;
    const { country, localNumber } = parsePhoneNumber(phoneStr);
    const cleanNum = localNumber.replace(/[\s\-_()]/g, "");
    if (!cleanNum) return false;
    
    if (country.code === "OTHER") {
        return /^\d{7,15}$/.test(cleanNum);
    }
    
    return country.pattern.test(cleanNum);
};

export const validateEmail = (emailStr) => {
    if (!emailStr) return false;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(emailStr.trim());
};
