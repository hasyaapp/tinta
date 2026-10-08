import { toBlob } from "./images";

/** Pinned Tesseract 7 worker protocol. Owning the worker lets cancel/error stop
 * WASM even during initialization, before createWorker would return a handle. */
export async function transcribe(
  source: HTMLCanvasElement,
  signal: AbortSignal,
  progress: (value: number) => void,
): Promise<string> {
  signal.throwIfAborted();
  const root = new URL("/ocr/", location.href).href;
  const worker = new Worker(root + "worker.min.js");
  let sequence = 0;
  let pending: {
    id: string;
    resolve: (data: any) => void;
    reject: (error: Error) => void;
  } | null = null;
  const stop = () => {
    worker.terminate();
    pending?.reject(new DOMException("Conversion cancelled", "AbortError"));
    pending = null;
  };
  const job = (action: string, payload: object): Promise<any> => {
    signal.throwIfAborted();
    const id = String(++sequence);
    return new Promise((resolve, reject) => {
      pending = { id, resolve, reject };
      worker.postMessage({ workerId: "paper-ocr", jobId: id, action, payload });
    });
  };
  worker.onmessage = ({ data: message }) => {
    if (signal.aborted || message.jobId !== pending?.id) return;
    if (message.status === "progress") {
      const value = message.data;
      progress(
        value.status === "recognizing text"
          ? 0.3 + value.progress * 0.7
          : Math.min(0.3, sequence * 0.06),
      );
    } else if (message.status === "reject") {
      pending?.reject(new Error(String(message.data)));
      pending = null;
    } else if (message.status === "resolve") {
      pending?.resolve(message.data);
      pending = null;
    }
  };
  worker.onerror = (event) => {
    event.preventDefault();
    pending?.reject(
      new Error(event.message || "Text recognition could not start."),
    );
    pending = null;
  };
  signal.addEventListener("abort", stop, { once: true });
  try {
    await job("load", {
      options: { lstmOnly: true, corePath: root + "core", logging: false },
    });
    await job("loadLanguage", {
      langs: "eng",
      options: {
        langPath: root,
        gzip: true,
        lstmOnly: true,
        cacheMethod: "none",
      },
    });
    await job("initialize", { langs: "eng", oem: 1, config: {} });
    await job("setParameters", { params: { tessedit_pageseg_mode: "11" } });
    const image = new Uint8Array(await (await toBlob(source)).arrayBuffer());
    const result = await job("recognize", {
      image,
      options: {},
      output: { text: true },
    });
    return String(result.text || "").trim();
  } finally {
    signal.removeEventListener("abort", stop);
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  }
}
