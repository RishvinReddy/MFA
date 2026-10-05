export const getDeviceFingerprint = async (): Promise<{ hash: string; specs: any }> => {
    // 1. Gather Browser Attributes
    const specs = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: (navigator as any).deviceMemory,
        screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        pixelRatio: window.devicePixelRatio
    };

    // 2. Canvas Fingerprinting
    // Render a hidden canvas with specific text and shapes. 
    // Differences in GPU/Drivers will cause subtle pixel differences.
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let canvasHash = 'unknown';

    if (ctx) {
        canvas.width = 200;
        canvas.height = 50;

        // Text with sensitive font rendering
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("BioShield-MFA-2025", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("BioShield-MFA-2025", 4, 17);

        canvasHash = canvas.toDataURL();
    }

    // 3. Create Composite String
    const fingerprintString = JSON.stringify(specs) + canvasHash;

    // 4. Hash using Web Crypto API (SHA-256)
    const msgBuffer = new TextEncoder().encode(fingerprintString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return { hash: hashHex, specs };
};
