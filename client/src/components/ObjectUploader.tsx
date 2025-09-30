import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import { DashboardModal } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A file upload component that renders as a button and provides a modal interface for
 * file management.
 * 
 * Features:
 * - Renders as a customizable button that opens a file upload modal
 * - Provides a modal interface for:
 *   - File selection
 *   - File preview
 *   - Upload progress tracking
 *   - Upload status display
 * 
 * The component uses Uppy under the hood to handle all file upload functionality.
 * All file management features are automatically handled by the Uppy dashboard modal.
 * 
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed to be uploaded
 *   (default: 1)
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.onGetUploadParameters - Function to get upload parameters (method and URL).
 *   Typically used to fetch a presigned URL from the backend server for direct-to-S3
 *   uploads.
 * @param props.onComplete - Callback function called when upload is complete. Typically
 *   used to make post-upload API calls to update server state and set object ACL
 *   policies.
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    console.log("MODAL: showModal state changed to:", showModal);
  }, [showModal]);

  const [uppy] = useState(() => {
    console.log("MODAL: Creating Uppy instance");
    
    try {
      const uppyInstance = new Uppy({
        restrictions: {
          maxNumberOfFiles,
          maxFileSize,
          allowedFileTypes: ['image/*'], // Only allow images for logos
        },
        autoProceed: false,
      });

      console.log("MODAL: Uppy instance created, adding AwsS3 plugin");

      uppyInstance
        .use(AwsS3, {
          shouldUseMultipart: false,
          getUploadParameters: async (file) => {
            try {
              console.log("UPLOAD: Getting upload parameters for file:", file.name);
              const params = await onGetUploadParameters();
              console.log("UPLOAD: Received parameters:", params);
              return params;
            } catch (error) {
              console.error("UPLOAD: Error getting upload parameters:", error);
              throw error;
            }
          },
        })
        .on("complete", (result) => {
          console.log("UPLOAD: Upload complete:", result);
          onComplete?.(result);
          setShowModal(false);
        })
        .on("error", (error) => {
          console.error("UPLOAD: Uppy general error:", error);
          setShowModal(false); // Close modal on error
        })
        .on("upload-error", (file, error, response) => {
          console.error("UPLOAD: Upload error for file:", file?.name, error, response);
        })
        .on("file-added", (file) => {
          console.log("UPLOAD: File added:", file.name);
        })
        .on("restriction-failed", (file, error) => {
          console.error("UPLOAD: Restriction failed:", file?.name, error);
        })
        .on("dashboard:modal-closed", () => {
          console.log("UPLOAD: Dashboard modal closed by uppy");
          setShowModal(false);
        });

      console.log("MODAL: Uppy instance fully configured");
      return uppyInstance;
    } catch (error) {
      console.error("MODAL: Error creating Uppy instance:", error);
      // Return a basic uppy instance without AwsS3 for debugging
      return new Uppy({
        restrictions: {
          maxNumberOfFiles,
          maxFileSize,
          allowedFileTypes: ['image/*'],
        },
        autoProceed: false,
      });
    }
  });

  return (
    <div>
      <Button 
        type="button"
        onClick={() => {
          console.log("MODAL: Upload button clicked, opening modal");
          setShowModal(true);
        }} 
        className={buttonClassName} 
        variant="outline" 
        size="sm"
        data-testid="upload-logo-button"
        title="Upload vendor logo"
      >
        {children}
      </Button>

      {showModal && (
        <DashboardModal
          uppy={uppy}
          open={showModal}
          onRequestClose={() => {
            console.log("MODAL: Dashboard modal close requested by user");
            setShowModal(false);
          }}
          proudlyDisplayPoweredByUppy={false}
          closeAfterFinish={false}
          showProgressDetails={true}
          hideProgressAfterFinish={false}
        />
      )}
    </div>
  );
}