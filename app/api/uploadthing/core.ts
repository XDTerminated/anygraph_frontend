import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";

const f = createUploadthing();

export const ourFileRouter = {
  datasetUploader: f({
    "text/csv": { maxFileSize: "32MB" },
    "application/vnd.ms-excel": { maxFileSize: "32MB" },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      maxFileSize: "32MB",
    },
  })
    .middleware(async () => {
      const user = await auth();

      if (!user.userId) throw new Error("Unauthorized");

      return { userId: user.userId };
    })
    .onUploadComplete(async ({ metadata }) => {
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
