import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Info,
  MessageSquareQuote,
  PackageCheck,
  QrCode,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/appStore";
import { updateOrderStatus } from "@/services/orderService";
import { fmtTime, fmtTimeAmPm, inr } from "@/lib/time";
import { playScanSuccessSound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

export function ScanView() {
  const orders = useAppStore((s) => s.orders);
  const menu = useAppStore((s) => s.menu);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [handingOver, setHandingOver] = useState(false);
  const [justHandedOver, setJustHandedOver] = useState<Order | null>(null);

  const readyOrders = orders
    .filter((o) => o.status === "ready")
    .sort((a, b) => (a.shelf ?? 99) - (b.shelf ?? 99));

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code && code.data) {
            processScannedString(code.data);
          } else {
            toast.error("No valid QR code found in the image. You can enter the Token # below.");
          }
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    setIsPermissionDenied(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported on this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        scanLoop();
      }
    } catch (err: any) {
      console.warn("Camera start failed:", err);
      const isDenied =
        err?.name === "NotAllowedError" ||
        err?.message?.toLowerCase().includes("permission denied") ||
        err?.message?.toLowerCase().includes("not allowed");
      setIsPermissionDenied(isDenied);
      setCameraError(
        isDenied
          ? "Camera permission was denied by the browser or Windows system settings."
          : err?.message || "Could not open camera.",
      );
      setCameraActive(false);
    }
  };

  const scanLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          processScannedString(code.data);
          return;
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);
  };

  const processScannedString = (raw: string) => {
    const text = raw.trim();
    if (!text) return;

    const cleanId = text.replace(/^DEQUEUE:/i, "").trim();
    const cleanNum = text.replace(/[^0-9]/g, "");

    const matched =
      orders.find((o) => o.id.toLowerCase() === cleanId.toLowerCase()) ||
      orders.find((o) => cleanId && o.id.toLowerCase().includes(cleanId.toLowerCase())) ||
      (cleanNum ? orders.find((o) => o.number === Number(cleanNum)) : undefined);

    if (matched) {
      playScanSuccessSound();
      if ("vibrate" in navigator) {
        try {
          navigator.vibrate([80, 40, 80]);
        } catch {
          /* no-op */
        }
      }
      setSelectedOrder(matched);
      setJustHandedOver(null);
      toast.success(`Scanned Token #${matched.number} (${matched.studentName})`);
    } else {
      toast.error(`No matching order found for "${text}"`);
      if (cameraActive) {
        setTimeout(() => {
          animFrameRef.current = requestAnimationFrame(scanLoop);
        }, 1200);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processScannedString(manualInput);
    setManualInput("");
  };

  const handleHandover = async () => {
    if (!selectedOrder) return;
    setHandingOver(true);
    try {
      await updateOrderStatus(selectedOrder.id, "collected");
      playScanSuccessSound();
      const updated = { ...selectedOrder, status: "collected" as const, collectedAt: Date.now() };
      setJustHandedOver(updated);
      setSelectedOrder(null);
      toast.success(`✅ Food handed over! Order #${updated.number} marked Collected.`);
    } catch {
      toast.error("Failed to mark order collected. Please try again.");
    } finally {
      setHandingOver(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl flex items-center gap-2">
            <QrCode className="size-7 text-primary" /> Scan QR & Hand Over Food
          </h1>
          <p className="text-sm text-muted-foreground">
            Scan student order QR codes or barcode guns to verify tokens and confirm food delivery.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Left Column: Live Camera Scanner */}
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border bg-black/95 aspect-video sm:aspect-[4/3] flex items-center justify-center shadow-soft">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            {cameraActive && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative size-52 sm:size-64 rounded-2xl border-2 border-primary/80 shadow-[0_0_25px_rgba(249,115,22,0.4)]">
                  <div className="absolute top-0 left-0 size-5 border-t-4 border-l-4 border-primary rounded-tl-md" />
                  <div className="absolute top-0 right-0 size-5 border-t-4 border-r-4 border-primary rounded-tr-md" />
                  <div className="absolute bottom-0 left-0 size-5 border-b-4 border-l-4 border-primary rounded-bl-md" />
                  <div className="absolute bottom-0 right-0 size-5 border-b-4 border-r-4 border-primary rounded-br-md" />
                  <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse absolute top-1/2 -translate-y-1/2" />
                </div>
                <p className="mt-4 text-xs font-bold text-white/95 drop-shadow">
                  Position student QR code within frame
                </p>
              </div>
            )}

            {!cameraActive && (
              <div className="p-6 text-center text-white/90 space-y-3.5 max-w-md mx-auto">
                {isPermissionDenied ? (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/20 p-3.5 text-left text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-red-200">
                      <ShieldAlert className="size-4 shrink-0 text-red-400" />
                      <span>Camera Blocked by Browser or Windows</span>
                    </div>
                    <ol className="list-decimal pl-4 space-y-1 text-white/80 text-[11px] leading-relaxed">
                      <li>
                        <strong>Browser:</strong> Click the <strong>lock / site settings icon (🔒)</strong> in the URL address bar &rarr; Set <strong>Camera</strong> to <strong>Allow</strong>.
                      </li>
                      <li>
                        <strong>Windows:</strong> Open <strong>Settings &rarr; Privacy & security &rarr; Camera</strong> &rarr; Switch ON <strong>"Let desktop apps access your camera"</strong>.
                      </li>
                    </ol>
                  </div>
                ) : (
                  <div>
                    <CameraOff className="size-10 mx-auto text-white/50" />
                    <p className="text-xs text-white/80 mt-2">
                      {cameraError || "Camera inactive. You can upload a photo of the QR code or enter token below."}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs bg-white/10 hover:bg-white/20 text-white border-white/25"
                    onClick={startCamera}
                  >
                    <Camera className="size-3.5 mr-1.5" /> Retry Camera
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs bg-primary/20 hover:bg-primary/30 text-primary border-primary/40 font-semibold"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-3.5 mr-1.5" /> Upload QR Photo
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleImageFile}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Search by Token / Barcode gun input */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Enter Token # (e.g. 104) or scan with USB barcode scanner..."
                className="pl-10 rounded-2xl h-12 text-sm font-medium"
              />
            </div>
            <Button type="submit" className="h-12 rounded-2xl px-6 font-bold">
              Find
            </Button>
          </form>

          {/* Waiting on shelves quick list */}
          {readyOrders.length > 0 && (
            <div className="rounded-2xl border bg-card p-4 space-y-3 shadow-soft">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-muted-foreground">
                  Ready on Shelves ({readyOrders.length})
                </span>
                <span className="text-muted-foreground">Tap any order to inspect</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                {readyOrders.map((ro) => (
                  <button
                    key={ro.id}
                    type="button"
                    onClick={() => {
                      setSelectedOrder(ro);
                      stopCamera();
                    }}
                    className="flex flex-col text-left rounded-xl border bg-card p-2.5 transition hover:border-primary hover:bg-accent/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-extrabold text-sm text-primary">
                        #{ro.number}
                      </span>
                      {ro.shelf && (
                        <span className="rounded bg-primary/15 text-primary text-[10px] font-bold px-1.5 py-0.5">
                          Shelf #{ro.shelf}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold truncate text-foreground mt-1">
                      {ro.studentName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {ro.items.reduce((s, i) => s + i.qty, 0)} items · {inr(ro.total)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Order Verification & Handover Action */}
        <div className="space-y-4">
          {justHandedOver && !selectedOrder && (
            <div className="rounded-3xl border-2 border-load-free bg-load-free-soft/40 p-6 text-center space-y-3 shadow-soft animate-in fade-in-50">
              <CheckCircle2 className="size-12 mx-auto text-load-free" />
              <h2 className="font-display text-2xl font-bold">
                Food Handed Over — Order #{justHandedOver.number}
              </h2>
              <p className="text-sm text-muted-foreground">
                Successfully delivered to{" "}
                <strong className="text-foreground">{justHandedOver.studentName}</strong>{" "}
                {justHandedOver.shelf ? `from Shelf #${justHandedOver.shelf}` : ""}.
              </p>
              <div className="pt-2">
                <Button
                  onClick={() => {
                    setJustHandedOver(null);
                    if (cameraActive) animFrameRef.current = requestAnimationFrame(scanLoop);
                  }}
                  className="rounded-2xl px-6 font-bold"
                >
                  Scan Next Order
                </Button>
              </div>
            </div>
          )}

          {selectedOrder ? (
            <div className="rounded-3xl border-2 border-primary/50 bg-card p-6 space-y-5 shadow-soft animate-in fade-in-50">
              <div className="flex items-start justify-between gap-3 border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-4xl font-extrabold text-primary">
                      #{selectedOrder.number}
                    </span>
                    {selectedOrder.shelf && (
                      <span className="rounded-xl bg-primary text-primary-foreground px-3 py-1 text-xs font-bold">
                        Shelf #{selectedOrder.shelf}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold mt-1.5">{selectedOrder.studentName}</h3>
                  <p className="text-xs text-muted-foreground">
                    Pickup slot: {fmtTimeAmPm(selectedOrder.slotTime)}
                  </p>
                </div>

                <div className="text-right">
                  <span className="font-display text-2xl font-extrabold tabular">
                    {inr(selectedOrder.total)}
                  </span>
                  <p className="text-xs font-semibold mt-1">
                    {selectedOrder.payment === "upi" ? (
                      <span className="text-load-free font-bold">✓ Paid via UPI</span>
                    ) : (
                      <span className="text-amber-500 font-bold">⚠️ Cash at Counter</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Order Items:
                </p>
                <ul className="space-y-2 rounded-2xl bg-muted/40 p-4">
                  {selectedOrder.items.map((item, idx) => {
                    const m = menu.find((x) => x.id === item.itemId);
                    return (
                      <li key={idx} className="flex justify-between items-center text-sm">
                        <span className="font-bold text-foreground">
                          {item.qty} × {m?.name ?? item.itemId}
                        </span>
                        {item.modifiers.length > 0 && (
                          <span className="text-muted-foreground italic text-xs">
                            ({item.modifiers.join(", ")})
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {selectedOrder.instructions && (
                  <div className="mt-2.5 rounded-xl border border-amber-500/40 bg-amber-500/15 p-3 text-xs text-amber-800 dark:text-amber-200">
                    <p className="font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      <MessageSquareQuote className="size-4" /> Special Student Request:
                    </p>
                    <p className="font-semibold italic mt-1 text-foreground bg-background/60 p-2 rounded-lg border border-border">
                      "{selectedOrder.instructions}"
                    </p>
                  </div>
                )}
              </div>

              {/* Cash Alert */}
              {selectedOrder.payment === "counter" && selectedOrder.status !== "collected" && (
                <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
                  <AlertCircle className="size-5 shrink-0" />
                  <span>
                    <strong>Payment Pending:</strong> Collect <strong>{inr(selectedOrder.total)}</strong> cash at counter before handing over the food.
                  </span>
                </div>
              )}

              {/* Handover Action Button */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-2xl h-14"
                  onClick={() => {
                    setSelectedOrder(null);
                    if (cameraActive) animFrameRef.current = requestAnimationFrame(scanLoop);
                  }}
                >
                  Cancel / Re-scan
                </Button>

                {selectedOrder.status === "collected" ? (
                  <Button disabled className="flex-1 rounded-2xl h-14 bg-muted font-bold text-base">
                    Already Collected
                  </Button>
                ) : (
                  <Button
                    className="flex-1 rounded-2xl h-14 bg-primary text-primary-foreground font-bold text-base shadow-md hover:opacity-95"
                    disabled={handingOver}
                    onClick={handleHandover}
                  >
                    <PackageCheck className="size-5 mr-2" />
                    {handingOver ? "Updating..." : "Hand Over Food"}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border bg-card p-8 text-center space-y-3 shadow-soft flex flex-col items-center justify-center min-h-[300px]">
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <QrCode className="size-8" />
              </div>
              <h3 className="font-display text-xl font-bold">Waiting for Scan</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Scan the student's order QR code from their mobile screen to verify and hand over their meal.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

