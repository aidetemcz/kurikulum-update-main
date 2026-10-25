"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Mark } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

type Rect = { x: number; y: number; w: number; h: number };

// Na dotykovém displeji se kreslí až po podržení prstu, aby šlo normálně rolovat.
const TOUCH_HOLD_MS = 320;
// Kratší tažení než 1 % šířky bereme jako omyl.
const MIN_SIZE = 0.01;

type Drag =
  | { kind: "create"; x0: number; y0: number; x1: number; y1: number }
  | { kind: "move"; id: string; grabX: number; grabY: number }
  | { kind: "resize"; id: string; anchorX: number; anchorY: number };

// Průhledná vrstva nad jednou stránkou PDF: kreslení nových značek,
// posouvání a zvětšování těch hotových.
export function MarkLayer({
  marks,
  numbers,
  editable,
  hidden,
  hoveredId,
  mutedIds,
  showDemo,
  t,
  onCreate,
  onUpdate,
  onDelete,
  onHover,
  onOpen,
}: {
  marks: Mark[];
  /** Pořadové číslo značky podle pořadí čtení. */
  numbers: Record<string, number>;
  editable: boolean;
  hidden: boolean;
  hoveredId: string | null;
  /** Značky upozaděné filtrem podle druhu změny – zůstávají vidět, jen bledě. */
  mutedIds?: Set<string>;
  showDemo: boolean;
  t: Dictionary;
  onCreate: (rect: Rect) => void;
  onUpdate: (id: string, rect: Rect) => void;
  onDelete: (id: string) => void;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const holdTimer = useRef<number | null>(null);

  // Poloha ukazatele přepočtená na podíl 0..1 vůči stránce.
  function toFraction(event: React.PointerEvent | PointerEvent) {
    const box = layerRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return {
      x: clamp((event.clientX - box.left) / box.width),
      y: clamp((event.clientY - box.top) / box.height),
    };
  }

  function startCreate(event: React.PointerEvent) {
    const { x, y } = toFraction(event);
    layerRef.current?.setPointerCapture(event.pointerId);
    setDrag({ kind: "create", x0: x, y0: y, x1: x, y1: y });
  }

  function handlePointerDown(event: React.PointerEvent) {
    if (!editable || hidden || event.button !== 0) return;
    // Bez tohohle prohlížeč začne tažením označovat text stránky
    // místo kreslení značky.
    event.preventDefault();

    if (event.pointerType === "touch") {
      const pointerId = event.pointerId;
      const clientX = event.clientX;
      const clientY = event.clientY;
      holdTimer.current = window.setTimeout(() => {
        const box = layerRef.current?.getBoundingClientRect();
        if (!box) return;
        layerRef.current?.setPointerCapture(pointerId);
        const x = clamp((clientX - box.left) / box.width);
        const y = clamp((clientY - box.top) / box.height);
        setDrag({ kind: "create", x0: x, y0: y, x1: x, y1: y });
      }, TOUCH_HOLD_MS);
      return;
    }

    startCreate(event);
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!drag) return;
    const { x, y } = toFraction(event);

    if (drag.kind === "create") {
      setDrag({ ...drag, x1: x, y1: y });
      return;
    }

    const mark = marks.find((m) => m.id === drag.id);
    if (!mark) return;

    if (drag.kind === "move") {
      onUpdate(drag.id, {
        x: clamp(x - drag.grabX, 0, 1 - mark.w),
        y: clamp(y - drag.grabY, 0, 1 - mark.h),
        w: mark.w,
        h: mark.h,
      });
    } else {
      onUpdate(drag.id, rectFromPoints(drag.anchorX, drag.anchorY, x, y));
    }
  }

  function handlePointerUp() {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }

    if (drag?.kind === "create") {
      const rect = rectFromPoints(drag.x0, drag.y0, drag.x1, drag.y1);
      if (rect.w >= MIN_SIZE && rect.h >= MIN_SIZE) onCreate(rect);
    }
    setDrag(null);
  }

  const preview = drag?.kind === "create" ? rectFromPoints(drag.x0, drag.y0, drag.x1, drag.y1) : null;

  return (
    <div
      ref={layerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      // z-10: textová vrstva react-pdf má z-index 2 a bez tohohle by
      // zachytávala myš místo kreslení
      className={`absolute inset-0 z-10 select-none ${editable && !hidden ? "cursor-crosshair" : ""}`}
      style={{ touchAction: "pan-y" }}
    >
      {!hidden &&
        marks.map((mark) => (
          <MarkBox
            key={mark.id}
            mark={mark}
            number={numbers[mark.id]}
            editable={editable}
            dimmed={
              (hoveredId !== null && hoveredId !== mark.id) || Boolean(mutedIds?.has(mark.id))
            }
            highlighted={hoveredId === mark.id}
            t={t}
            onHover={onHover}
            onDelete={() => onDelete(mark.id)}
            onOpen={() => onOpen(mark.id)}
            onStartMove={(event) => {
              const { x, y } = toFraction(event);
              layerRef.current?.setPointerCapture(event.pointerId);
              setDrag({ kind: "move", id: mark.id, grabX: x - mark.x, grabY: y - mark.y });
            }}
            onStartResize={(event, anchorX, anchorY) => {
              layerRef.current?.setPointerCapture(event.pointerId);
              setDrag({ kind: "resize", id: mark.id, anchorX, anchorY });
            }}
          />
        ))}

      {preview && (
        <div
          className="pointer-events-none absolute rounded-[3px] border-2 border-coral"
          style={{
            left: `${preview.x * 100}%`,
            top: `${preview.y * 100}%`,
            width: `${preview.w * 100}%`,
            height: `${preview.h * 100}%`,
            backgroundColor: "rgba(220,91,91,.14)",
          }}
        />
      )}

      {showDemo && !drag && <DemoRect label={t.demoLabel} />}
    </div>
  );
}

function MarkBox({
  mark,
  number,
  editable,
  dimmed,
  highlighted,
  t,
  onHover,
  onDelete,
  onOpen,
  onStartMove,
  onStartResize,
}: {
  mark: Mark;
  number: number;
  editable: boolean;
  dimmed: boolean;
  highlighted: boolean;
  t: Dictionary;
  onHover: (id: string | null) => void;
  onDelete: () => void;
  onOpen: () => void;
  onStartMove: (event: React.PointerEvent) => void;
  onStartResize: (event: React.PointerEvent, anchorX: number, anchorY: number) => void;
}) {
  const [hover, setHover] = useState(false);
  const [pressedAt, setPressedAt] = useState<{ x: number; y: number } | null>(null);

  // Protější roh zůstává při zvětšování na místě.
  const corners = [
    { key: "nw", cls: "-left-1 -top-1 cursor-nwse-resize", anchorX: mark.x + mark.w, anchorY: mark.y + mark.h },
    { key: "ne", cls: "-right-1 -top-1 cursor-nesw-resize", anchorX: mark.x, anchorY: mark.y + mark.h },
    { key: "sw", cls: "-left-1 -bottom-1 cursor-nesw-resize", anchorX: mark.x + mark.w, anchorY: mark.y },
    { key: "se", cls: "-right-1 -bottom-1 cursor-nwse-resize", anchorX: mark.x, anchorY: mark.y },
  ];

  return (
    <div
      onPointerDown={(event) => {
        event.stopPropagation();
        setPressedAt({ x: event.clientX, y: event.clientY });
        if (editable) onStartMove(event);
      }}
      onPointerUp={(event) => {
        // Krátké kliknutí (ne tažení) otevře kartičku s popisem.
        const moved =
          pressedAt &&
          Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) > 4;
        setPressedAt(null);
        if (!moved) onOpen();
      }}
      onMouseEnter={() => {
        setHover(true);
        onHover(mark.id);
      }}
      onMouseLeave={() => {
        setHover(false);
        onHover(null);
      }}
      className={`absolute rounded-[3px] border-2 border-coral transition-opacity ${
        editable ? "cursor-move" : ""
      } ${dimmed ? "opacity-20" : "opacity-100"} ${highlighted ? "ring-2 ring-coral/40" : ""}`}
      style={{
        left: `${mark.x * 100}%`,
        top: `${mark.y * 100}%`,
        width: `${mark.w * 100}%`,
        height: `${mark.h * 100}%`,
        backgroundColor: "rgba(220,91,91,.14)",
      }}
    >
      <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-coral text-[10px] font-semibold text-white">
        {number}
      </span>

      {editable && hover && (
        <>
          <button
            type="button"
            aria-label={t.delete}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onDelete}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white"
          >
            <X size={12} />
          </button>

          {corners.map((corner) => (
            <span
              key={corner.key}
              onPointerDown={(event) => {
                event.stopPropagation();
                onStartResize(event, corner.anchorX, corner.anchorY);
              }}
              className={`absolute h-2.5 w-2.5 rounded-sm border border-coral bg-white ${corner.cls}`}
            />
          ))}
        </>
      )}
    </div>
  );
}

// Jednorázová ukázka gesta pro někoho, kdo appku vidí poprvé.
function DemoRect({ label }: { label: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="demo-rect pointer-events-none absolute rounded-[3px] border-2 border-dashed border-coral"
      style={{ left: "18%", top: "22%", ["--demo-w" as string]: "40%", ["--demo-h" as string]: "14%" }}
    >
      <span className="absolute -bottom-6 right-0 rounded-pill bg-ink px-2 py-0.5 text-[10px] font-medium text-white">
        {label}
      </span>
    </div>
  );
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function rectFromPoints(x0: number, y0: number, x1: number, y1: number): Rect {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  };
}
