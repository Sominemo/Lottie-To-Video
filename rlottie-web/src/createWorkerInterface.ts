import type {
    CancellableCallback,
    OriginMessageEvent,
    WorkerMessageData,
} from "./WorkerConnector";

declare const self: WorkerGlobalScope;

handleErrors();

const callbackState = new Map<string, CancellableCallback>();

export default function createInterface(api: Record<string, Function>) {
    onmessage = async (message: OriginMessageEvent) => {
        const { data } = message;

        switch (data.type) {
            case "callMethod": {
                const { messageId, name, args, withCallback } = data;
                try {
                    if (messageId && withCallback) {
                        const callback = (...callbackArgs: any[]) => {
                            const lastArg =
                                callbackArgs[callbackArgs.length - 1];

                            sendToOrigin(
                                {
                                    type: "methodCallback",
                                    messageId,
                                    callbackArgs,
                                },
                                isTransferable(lastArg) ? [lastArg] : undefined
                            );
                        };

                        callbackState.set(messageId, callback);

                        args.push(callback as never);
                    }

                    const [response, arrayBuffers] =
                        (await api[name](...args)) || [];

                    if (messageId) {
                        sendToOrigin(
                            {
                                type: "methodResponse",
                                messageId,
                                response,
                            },
                            arrayBuffers
                        );
                    }
                } catch (error: any) {

                    if (messageId) {
                        sendToOrigin({
                            type: "methodResponse",
                            messageId,
                            error: { message: error.message },
                        });
                    }
                }

                if (messageId) {
                    callbackState.delete(messageId);
                }

                break;
            }
            case "cancelProgress": {
                const callback = callbackState.get(data.messageId);
                if (callback) {
                    callback.isCanceled = true;
                }

                break;
            }
        }
    };
}

function isTransferable(obj: any) {
    return obj instanceof ArrayBuffer || obj instanceof ImageBitmap;
}

function handleErrors() {
    self.onerror = (e) => {
        // eslint-disable-next-line no-console
        console.error(e);
        sendToOrigin({
            type: "unhandledError",
            error: {
                message: e.error.message || "Uncaught exception in worker",
            },
        });
    };

    self.addEventListener("unhandledrejection", (e) => {
        // eslint-disable-next-line no-console
        console.error(e);
        sendToOrigin({
            type: "unhandledError",
            error: {
                message: e.reason.message || "Uncaught rejection in worker",
            },
        });
    });
}

function sendToOrigin(data: WorkerMessageData, transferables?: Transferable[]) {
    if (transferables) {
        postMessage(data, transferables);
    } else {
        postMessage(data);
    }
}
