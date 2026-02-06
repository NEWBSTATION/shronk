"use client";

import { useState, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Upload, Trash2, ArrowLeft, Loader2 } from "lucide-react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const OUTPUT_SIZE = 512;

interface AvatarEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getCroppedCanvas(
  imageSrc: string,
  croppedArea: Area
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(
        image,
        croppedArea.x,
        croppedArea.y,
        croppedArea.width,
        croppedArea.height,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
      );

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob"));
        },
        "image/png",
        1
      );
    };
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = imageSrc;
  });
}

export function AvatarEditorDialog({
  open,
  onOpenChange,
}: AvatarEditorDialogProps) {
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const resetState = useCallback(() => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please select a JPEG, PNG, GIF, or WebP image");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Image must be under 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels || !user) return;

    setUploading(true);
    try {
      const blob = await getCroppedCanvas(imageSrc, croppedAreaPixels);
      const file = new File([blob], "avatar.png", { type: "image/png" });
      await user.setProfileImage({ file });
      toast.success("Avatar updated");
      handleOpenChange(false);
    } catch {
      toast.error("Failed to update avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    setUploading(true);
    try {
      await user.setProfileImage({ file: null });
      toast.success("Avatar removed");
      handleOpenChange(false);
    } catch {
      toast.error("Failed to remove avatar");
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  const initials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user.firstName?.[0] ||
        user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() ||
        "U";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {imageSrc ? "Crop Avatar" : "Change Avatar"}
          </DialogTitle>
          <DialogDescription>
            {imageSrc
              ? "Drag to reposition and use the slider to zoom"
              : "Upload a new avatar or remove the current one"}
          </DialogDescription>
        </DialogHeader>

        {imageSrc ? (
          /* ── Crop View ── */
          <div className="space-y-4">
            <div className="relative mx-auto h-64 w-64 overflow-hidden rounded-lg bg-muted">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="flex items-center gap-3 px-2">
              <span className="text-xs text-muted-foreground">1x</span>
              <Slider
                min={1}
                max={3}
                step={0.1}
                value={[zoom]}
                onValueChange={([v]) => setZoom(v)}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground">3x</span>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={resetState}
                disabled={uploading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleApply}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Apply
              </Button>
            </div>
          </div>
        ) : (
          /* ── Initial View ── */
          <div className="space-y-4">
            <div className="flex justify-center">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.imageUrl} alt="Current avatar" />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Image
              </Button>
              {user.hasImage && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleRemove}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Remove
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
