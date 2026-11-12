import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquareQuote,
  PackageCheck,
  QrCode,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
  Utensils,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/appStore";
import { updateOrderStatus } from "@/services/orderService";
import { fmtTime, fmtTimeAmPm, inr } from "@/lib/time";
import { playScanSuccessSound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

interface OrderQRScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHandoverSuccess?: (order: Order) => void;
}

export function OrderQRScannerModal({
  open,
  onOpenChange,
  onHandoverSuccess,
}: OrderQRScannerModalProps) {
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

  // Stop camera helper
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

  // Start camera and continuous QR code decoding
  const startCamera = async () => {
    setCameraError(null);
    setIsPermissionDenied(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this browser.");
      }

      let stream: MediaStream | null = null;
      try {
        // Step 1: Flexible environment camera (smartphones/tablets)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } },
        });
      } catch (e1) {
        // Step 2: Fallback to basic webcam (standard for Windows laptops, PCs, USB webcams)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }

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
        err?.name === "OverconstrainedError" ||
        err?.message?.toLowerCase().includes("permission denied") ||
        err?.message?.toLowerCase().includes("not allowed");
      setIsPermissionDenied(isDenied);
      setCameraError(
        isDenied
          ? "Camera blocked by system, preview frame, or in use by another app."
          : err?.message || "Could not open camera.",
      );
      setCameraActive(false);
    }
  };

  // Continuous frame scanning loop
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
          return; // pause scan loop once detected
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);
  };

  // Match scanned text to order in store
  const processScannedString = (raw: string) => {
    const text = raw.trim();
    if (!text) return;

    // Check for DEQUEUE:o101 or o101 or #101 or 101
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
      // Resume scanning if camera is active
      if (cameraActive) {
        setTimeout(() => {
          animFrameRef.current = requestAnimationFrame(scanLoop);
        }, 1200);
      }
    }
  };

  // Submit manual input
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processScannedString(manualInput);
    setManualInput("");
  };

  // Confirm Handover: Mark food given to student
  const handleHandover = async () => {
    if (!selectedOrder) return;
    setHandingOver(true);
    try {
      await updateOrderStatus(selectedOrder.id, "collected");
      playScanSuccessSound();
      const updated = { ...selectedOrder, status: "collected" as const, collectedAt: Date.now() };
      setJustHandedOver(updated);
      setSelectedOrder(null);
      toast.success(
        `✅ Food handed over! Order #${updated.number} marked Collected.`,
      );
      onHandoverSuccess?.(updated);
    } catch {
      toast.error("Failed to mark order collected. Please try again.");
    } finally {
      setHandingOver(false);
    }
  };

  // Handle open/close state
  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setSelectedOrder(null);
      setJustHandedOver(null);
      setManualInput("");
    }
    return () => stopCamera();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2 text-primary font-bold">
            <QrCode className="size-5" />
            <span className="text-xs uppercase tracking-wider">Canteen Pickup Counter</span>
          </div>
          <DialogTitle className="font-display text-2xl font-bold">
            Scan QR & Hand Over Food
          </DialogTitle>
          <DialogDescription>
            Scan the student's order token QR code to verify their order and confirm food delivery.
          </DialogDescription>
        </DialogHeader>

        {/* Success Card when just handed over */}
        {justHandedOver && !selectedOrder && (
          <div className="rounded-2xl border-2 border-load-free bg-load-free-soft/40 p-4 text-center space-y-2 animate-in fade-in-50">
            <CheckCircle2 className="size-10 mx-auto text-load-free" />
            <h3 className="font-display text-lg font-bold">
              Food Handed Over — Order #{justHandedOver.number}
            </h3>
            <p className="text-xs text-muted-foreground">
              Delivered to <strong className="text-foreground">{justHandedOver.studentName}</strong>{" "}
              {justHandedOver.shelf ? `from Shelf #${justHandedOver.shelf}` : ""}.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setJustHandedOver(null);
                if (cameraActive) animFrameRef.current = requestAnimationFrame(scanLoop);
              }}
              className="mt-1 rounded-xl text-xs"
            >
              Scan Next Student
            </Button>
          </div>
        )}

        {/* Selected Order Verification Card */}
        {selectedOrder ? (
          <div className="rounded-2xl border-2 border-primary/50 bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-3xl font-extrabold text-primary">
                    #{selectedOrder.number}
                  </span>
                  {selectedOrder.shelf && (
                    <span className="rounded-lg bg-primary text-primary-foreground px-2 py-0.5 text-xs font-bold">
                      Shelf #{selectedOrder.shelf}
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                      selectedOrder.status === "ready"
                        ? "bg-load-free-soft text-load-free"
                        : selectedOrder.status === "collected"
                          ? "bg-muted text-muted-foreground"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    Status: {selectedOrder.status}
                  </span>
                </div>
                <p className="text-base font-semibold mt-1">{selectedOrder.studentName}</p>
                <p className="text-xs text-muted-foreground">
                  Pickup slot: {fmtTimeAmPm(selectedOrder.slotTime)}
                </p>
              </div>

              <div className="text-right">
                <span className="font-display text-xl font-bold tabular">
                  {inr(selectedOrder.total)}
                </span>
                <p className="text-xs font-medium">
                  {selectedOrder.payment === "upi" ? (
                    <span className="text-load-free font-semibold">✓ Paid via UPI</span>
                  ) : (
                    <span className="text-amber-500 font-semibold">⚠️ Cash at Counter</span>
                  )}
                </p>
              </div>
            </div>

            {/* Items to Hand Over */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Items to hand over:
              </p>
              <ul className="space-y-1.5 rounded-xl bg-muted/40 p-3 text-sm">
                {selectedOrder.items.map((item, idx) => {
                  const m = menu.find((x) => x.id === item.itemId);
                  return (
                    <li key={idx} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">
                        {item.qty} × {m?.name ?? item.itemId}
                      </span>
                      {item.modifiers.length > 0 && (
                        <span className="text-muted-foreground italic text-[11px]">
                          ({item.modifiers.join(", ")})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {selectedOrder.instructions && (
                <div className="mt-2.5 rounded-xl border border-amber-500/40 bg-amber-500/15 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                  <p className="font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    <MessageSquareQuote className="size-3.5" />
                    Special Student Request:
                  </p>
                  <p className="font-semibold italic mt-0.5 text-foreground">
                    "{selectedOrder.instructions}"
                  </p>
                </div>
              )}
            </div>

            {/* Counter Payment Alert */}
            {selectedOrder.payment === "counter" && selectedOrder.status !== "collected" && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  <strong>Collect Payment:</strong> Please collect <strong>{inr(selectedOrder.total)}</strong> cash/counter payment before handing over food.
                </span>
              </div>
            )}

            {/* Handover Action Buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setSelectedOrder(null);
                  if (cameraActive) animFrameRef.current = requestAnimationFrame(scanLoop);
                }}
              >
                Cancel / Re-scan
              </Button>

              {selectedOrder.status === "collected" ? (
                <Button disabled className="flex-1 rounded-xl bg-muted font-bold">
                  Already Handed Over
                </Button>
              ) : (
                <Button
                  className="flex-1 rounded-xl bg-primary text-primary-foreground font-bold shadow-md hover:opacity-95"
                  disabled={handingOver}
                  onClick={handleHandover}
                >
                  <PackageCheck className="size-4 mr-1.5" />
                  {handingOver ? "Updating..." : "Hand Over Food (Mark Delivered)"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Live Camera Scanner Viewport */}
            <div className="relative overflow-hidden rounded-2xl border bg-black/95 aspect-video sm:aspect-[4/3] flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Laser / Scanner Reticle Overlay */}
              {cameraActive && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="relative size-48 sm:size-56 rounded-2xl border-2 border-primary/80 shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                    <div className="absolute top-0 left-0 size-4 border-t-4 border-l-4 border-primary rounded-tl-md" />
                    <div className="absolute top-0 right-0 size-4 border-t-4 border-r-4 border-primary rounded-tr-md" />
                    <div className="absolute bottom-0 left-0 size-4 border-b-4 border-l-4 border-primary rounded-bl-md" />
                    <div className="absolute bottom-0 right-0 size-4 border-b-4 border-r-4 border-primary rounded-br-md" />
                    {/* Animated scanning line */}
                    <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse absolute top-1/2 -translate-y-1/2" />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-white/90 drop-shadow">
                    Hold student QR code inside the frame
                  </p>
                </div>
              )}

              {/* Camera Error or Off fallback */}
              {!cameraActive && (
                <div className="p-5 text-center text-white/90 space-y-3 max-w-sm mx-auto">
                  {isPermissionDenied ? (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/20 p-3 text-left text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-red-200">
                        <ShieldAlert className="size-4 shrink-0 text-red-400" />
                        <span>Camera Access Blocked</span>
                      </div>
                      <p className="text-[11px] text-white/90">
                        Even if allowed, access may be blocked if another app (Zoom, Teams, Camera) is using the webcam, or inside an embedded frame.
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full rounded-xl text-xs font-bold gap-1.5"
                        onClick={() => window.open(window.location.origin + "/manager/scan", "_blank")}
                      >
                        <ExternalLink className="size-3.5" /> Open Scanner in Real Tab
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <CameraOff className="size-8 mx-auto text-white/50" />
                      <p className="text-xs mt-1 text-white/80">
                        {cameraError || "Camera inactive. You can upload a photo of the QR code or enter token below."}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs bg-white/10 hover:bg-white/20 text-white border-white/20"
                      onClick={startCamera}
                    >
                      <Camera className="size-3 mr-1" /> Retry Camera
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs bg-primary/20 hover:bg-primary/30 text-primary border-primary/40 font-semibold"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="size-3 mr-1" /> Upload QR Photo
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

            {/* Manual Token / Barcode Gun Input */}
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Or enter Token # (e.g. 104) / scan with barcode gun..."
                  className="pl-9 rounded-xl h-11 text-sm font-medium"
                />
              </div>
              <Button type="submit" className="h-11 rounded-xl px-5 font-semibold">
                Find
              </Button>
            </form>

            {/* Quick List of Ready Orders on Shelves */}
            {readyOrders.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">
                    Ready on Shelves ({readyOrders.length})
                  </span>
                  <span>Tap to verify and hand over:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
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
                          <span className="rounded bg-primary/15 text-primary text-[10px] font-bold px-1.5 py-0.2">
                            Shelf #{ro.shelf}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold truncate text-foreground mt-0.5">
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
        )}
      </DialogContent>
    </Dialog>
  );
}
