type StepUpCallback = (success: boolean) => void;

class StepUpService {
    private listener: ((reason: string) => void) | null = null;
    private currentCallback: StepUpCallback | null = null;

    registerListener(listener: (reason: string) => void) {
        this.listener = listener;
    }

    unregisterListener() {
        this.listener = null;
    }

    requestStepUp(reason: string): Promise<boolean> {
        return new Promise((resolve) => {
            this.currentCallback = resolve;
            if (this.listener) {
                this.listener(reason);
            } else {
                console.warn('No StepUp listener registered');
                resolve(false);
            }
        });
    }

    complete(success: boolean) {
        if (this.currentCallback) {
            this.currentCallback(success);
            this.currentCallback = null;
        }
    }
}

export const stepUpService = new StepUpService();
