import { useEffect, useRef, useState } from "react";
import client from "../../api/client";
import { Card, Button, Banner } from "../../components/ui";

export default function SelfieStep({ onNext }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  };

  const startCamera = async () => {
    setError("");
    setCameraLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera is not supported in this browser.");
      }
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch (err) {
      setError(
        err?.message ||
          "Could not access the camera. Allow camera permission in your browser, or upload a photo instead."
      );
      stopCamera();
    } finally {
      setCameraLoading(false);
    }
  };

  useEffect(() => {
    if (!cameraOn || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {
      setError("Unable to start the camera preview. Try again or upload a photo.");
    });
  }, [cameraOn]);

  useEffect(() => () => stopCamera(), []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) {
      setError("Camera is not ready yet. Wait a moment and try again.");
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not capture the photo. Please try again.");
          return;
        }
        setCapturedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedBlob(null);
    setPreviewUrl(null);
    startCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    setCapturedBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!capturedBlob) return;
    setError("");
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", capturedBlob, "selfie.jpg");
      await client.post("/application/selfie", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onNext();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-2xl text-ink mb-1">Live Selfie Verification</h2>
      <p className="text-sm text-ink500 mb-6">
        This is the final step. Take a clear, well-lit photo of your face.
      </p>

      <Banner type="error">{error}</Banner>

      <div className="rounded-2xl overflow-hidden bg-ink/5 border border-hairline mb-4 aspect-[4/3] flex items-center justify-center relative">
        {previewUrl ? (
          <img src={previewUrl} alt="Captured selfie" className="w-full h-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${cameraOn ? "block" : "hidden"}`}
              muted
              playsInline
              autoPlay
            />
            {!cameraOn && (
              <div className="text-center text-ink500 text-sm p-8">
                <p className="mb-3">Camera preview will appear here.</p>
                <p className="text-xs">Your browser will ask for camera permission.</p>
              </div>
            )}
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-wrap gap-3">
        {!previewUrl && !cameraOn && (
          <>
            <Button variant="secondary" onClick={startCamera} disabled={cameraLoading}>
              {cameraLoading ? "Starting camera…" : "Turn On Camera"}
            </Button>
            <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
              Upload Photo Instead
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFileUpload}
            />
          </>
        )}
        {cameraOn && !previewUrl && (
          <>
            <Button onClick={capture}>Capture Photo</Button>
            <Button variant="ghost" onClick={stopCamera}>
              Cancel
            </Button>
          </>
        )}
        {previewUrl && (
          <>
            <Button variant="secondary" onClick={retake}>
              Retake
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit for Review"}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
