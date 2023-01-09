function showOpenFilePickerPolyfill(options = {}) {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = !!options.multiple;
        input.accept =
            options.types ??
            []
                .map((type) => type.accept)
                .flatMap((inst) =>
                    Object.keys(inst).flatMap((key) => inst[key])
                )
                .join(",");

        input.addEventListener("change", () => {
            resolve(
                [...input.files].map((file) => {
                    return {
                        getFile: async () =>
                            new Promise((resolve) => {
                                resolve(file);
                            }),
                    };
                })
            );
        });

        input.click();
    });
}

if (typeof window.showOpenFilePicker !== "function") {
    window.showOpenFilePicker = showOpenFilePickerPolyfill;
}

const rLottieShim = {
    loadAnimation: function (params) {
        animation.innerHTML =
            "rLottie is loading the animation and pre-rendering it as a first pass...";
        return new Promise((resolve) => {
            let onEndedCallback = () => {};
            const l = RLottie.init(
                "tgs",
                canvas,
                async () => {
                    l.play(true);
                    await new Promise((r) => {
                        onEndedCallback = () => r();
                    });
                    onEndedCallback = () => {};

                    const obj = {
                        setSpeed: (speed) => l.setSpeed(speed),
                        frameRate: 60,
                        play: () => l.play(true),
                        getDuration: (inSeconds) =>
                            inSeconds ? l.framesCount / 60 : l.framesCount,
                    };

                    Object.defineProperty(obj, "onComplete", {
                        set: (callback) => {
                            onEndedCallback = callback;
                        },
                    });

                    Object.defineProperty(obj, "onEnterFrame", {
                        set: (callback) => {},
                    });

                    resolve(obj);
                },
                "tgs",
                params.animationData,
                {
                    noLoop: true,
                    size: params.size,
                },
                params.container,
                () => onEndedCallback()
            );
        });
    },
};

async function recorder(json, name, tgsLink, { w, h } = {}) {
    canvas.width = width.value ? width.value : w ?? json.w;
    canvas.height = height.value ? height.value : h ?? json.h;

    const ctx = canvas.getContext("2d");

    if (ctx.reset) {
        ctx.reset();
    }

    const l = await initLottie();

    if (speed.value) {
        l.setSpeed(speed.value);
    }

    if (typeof tgsLink !== "string") {
        animation.innerHTML =
            `Dimensions: ${json.w}x${json.h}.<br>` +
            `Estimated duration: ${l.getDuration().toFixed(2)}s ` +
            (speed.value
                ? `[render duration: ${(l.getDuration() / speed.value).toFixed(
                      2
                  )}s]`
                : "") +
            ` (${l.getDuration(true)} frames, ${l.frameRate} fps)` +
            (tgsLink === true
                ? "<br>Telegram Sticker file was detected and decompressed."
                : "");
    } else {
        animation.innerHTML =
            `Dimensions: ${canvas.width}x${canvas.height}.<br>` +
            `Rendered using rLottie.`;
    }

    startRecording();
    l.play();

    function startRecording() {
        const chunks = [];
        const stream = canvas.captureStream(
            framerate.value ? framerate.value : l.frameRate
        );
        const rec = new MediaRecorder(stream, {
            mimeType: mimetype.value,
            videoBitsPerSecond: bitrate.value * 1024,
        });

        rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = (e) =>
            exportFile(new Blob(chunks, { type: mimetype.value }), name);
        l.onComplete = () => {
            progress.innerText = "Done!";
            rec.stop();
        };
        l.onEnterFrame = (e) => {
            progress.innerText = `${e.currentTime.toFixed(0)} / ${
                e.totalTime
            } frames (${((e.currentTime / e.totalTime) * 100).toFixed(2)}%)`;
        };

        rec.start();
    }

    function initLottie() {
        let lottieApi;
        if (typeof tgsLink === "boolean") {
            lottieApi = lottie;
        } else {
            lottieApi = rLottieShim;
        }

        return lottieApi.loadAnimation({
            renderer: "canvas",
            loop: false,
            autoplay: false,
            animationData: typeof tgsLink === "string" ? tgsLink : json,
            rendererSettings: {
                context: ctx,
                clearCanvas: true,
            },
            size: canvas.width,
        });
    }
}

function exportFile(blob, name) {
    const resultContainer = document.createElement("div");
    resultContainer.className = "result-block";
    results.appendChild(resultContainer);

    const vid = document.createElement("video");
    vid.src = URL.createObjectURL(blob);
    vid.controls = true;
    resultContainer.appendChild(vid);

    const a = document.createElement("a");
    a.className = "button";
    a.download = name + extension.value;
    a.href = vid.src;
    a.textContent = "Save";
    resultContainer.appendChild(a);
}

chooser.addEventListener("click", async () => {
    try {
        const fileHandles = await window.showOpenFilePicker();
        const fileHandle = fileHandles[0];
        const file = await fileHandle.getFile();
        let json;
        let tgsLink = false;
        let redefine = {};

        if (file.name.endsWith(".tgs")) {
            if (Number.parseInt(renderer.value)) {
                if (!("DecompressionStream" in window)) {
                    if (!width.value && !height.value)
                        throw "You must specify width and height for TGS files";
                    redefine = {
                        w: width.value,
                        h: height.value,
                    };
                } else {
                    const tempJson = await gzipFileToText(file);
                    redefine = {
                        w: tempJson.w,
                        h: tempJson.h,
                    };
                }
                tgsLink = URL.createObjectURL(file);
                json = {};
            } else {
                tgsLink = true;
                json = await gzipFileToText(file);
            }
        } else {
            json = JSON.parse(await file.text());
        }

        recorder(json, file.name, tgsLink, redefine);
    } catch (e) {
        alert(e);
        throw e;
    }
});

async function gzipFileToText(file) {
    const ds = new DecompressionStream("gzip");
    const reader = file.stream().pipeThrough(ds).getReader();
    let buffer = new Uint8Array();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer = new Uint8Array([...buffer, ...value]);
    }
    return JSON.parse(new TextDecoder().decode(buffer));
}

function setCodec(codec) {
    const codecs = {
        vp9: ['video/webm; codecs="vp9"', "webm"],
        vp8: ['video/webm; codecs="vp8"', "webm"],
    };

    mimetype.value = codecs[codec][0];
    extension.value = "." + codecs[codec][1];
}

function getSupportedMimeTypes() {
    const types = [
        ["webm", "webm"],
        ["ogg", "ogg"],
        ["mp4", "mp4"],
        ["x-matroska", "mkv"],
    ];
    const codecs = [
        ["vp8", "VP8"],
        ["vp8.0", "VP8"],
        ["vp9", "VP9"],
        ["vp9.0", "VP9"],
        ["avc1", "H.264"],
        ["av1", "AV1"],
        ["h265", "H.265"],
        ["h.265", "H.265"],
        ["h264", "H.264"],
        ["h.264", "H.264"],
        ["mpeg", "MPEG"],
    ];

    const isSupported = MediaRecorder.isTypeSupported;
    const supported = {};

    function makeKey(type, codec) {
        return `${type}/${codec}`;
    }

    types.forEach((type) => {
        const mimeType = `video/${type[0]}`;
        codecs.forEach((codec) =>
            [
                `${mimeType};codecs=${codec[0]}`,
                `${mimeType};codecs=${codec[0].toUpperCase()}`,
            ].forEach((variation) => {
                const key = makeKey(type[1], codec[1]);
                if (!(key in supported) && isSupported(variation)) {
                    supported[key] = [variation, type[1], codec[1]];
                }
            })
        );

        const key = makeKey(type[1], null);
        if (!(key in supported) && isSupported(mimeType)) {
            supported[key] = [mimeType, type[1], null];
        }
    });

    return supported;
}

function loadFormats() {
    const f = Object.values(getSupportedMimeTypes());
    formats.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a format";
    placeholder.disabled = true;
    placeholder.selected = true;
    formats.appendChild(placeholder);

    f.forEach((format) => {
        const option = document.createElement("option");
        option.value = format[0];
        option.textContent = `${format[1].toUpperCase()} ${
            format[2] ? `(${format[2]})` : ""
        }`;
        formats.appendChild(option);
    });

    formats.addEventListener("change", () => {
        mimetype.value = formats.value;
        extension.value = "." + f.find((x) => x[0] === formats.value)[1];
    });

    if (f.length > 0) {
        mimetype.value = f[0][0];
        extension.value = "." + f[0][1];
        formats.value = f[0][0];
    }
}

loadFormats();

if (!("DecompressionStream" in window)) {
    renderer.querySelector("option[value='0']").disabled = true;
    renderer.querySelector("option[value='0']").innerText += " (Not supported)";
}