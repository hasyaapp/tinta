import { useEffect, useRef } from "react";
import { bookMotion } from "../engine/book/motion";

/** The single WebGL canvas that paints every bending sheet: the page flip in
 *  the butterfly view and the opening/closing cover. It stays mounted for the
 *  whole app lifetime so one context serves every animation; while idle it is
 *  display:none and costs nothing. If WebGL2 is unavailable the controller
 *  reports not-ready and the components keep their CSS keyframe animations. */
export default function PageTurnLayer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => bookMotion.attach(canvas.current!), []);
  return <canvas ref={canvas} className="motion-canvas" aria-hidden="true" />;
}
