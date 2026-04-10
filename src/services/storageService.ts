

import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { FirebaseError } from "firebase/app";
import { app } from '@/lib/firebase';

const storage = app ? getStorage(app) : null;

export const uploadImage = (
  file: File,
  path: string = "images"
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!storage) {
      reject(new Error("Firebase Storage is not initialized."));
      return;
    }
    if (!file) {
      reject(new Error("No file provided for upload"));
      return;
    }

    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name.replace(/\s+/g, "_")}`;
    const storageRef = ref(storage, `${path}/${fileName}`);
    
    console.log(`Starting resumable upload for ${fileName} to path: ${path}`);

    const metadata = {
      contentType: file.type || "image/jpeg",
    };

    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Upload is ' + progress + '% done');
      },
      (error: FirebaseError) => {
        console.error("Firebase Storage Upload Error:", error);
        console.error("Error Code:", error.code);
        console.error("Full Error Object:", error);
        
        let userFriendlyMessage = `Upload failed. Code: ${error.code}.`;

        switch (error.code) {
          case 'storage/unauthorized':
              userFriendlyMessage = "Permission denied. Please check your Firebase Storage security rules.";
              break;
          case 'storage/canceled':
              userFriendlyMessage = "Upload was canceled.";
              break;
          case 'storage/retry-limit-exceeded':
              userFriendlyMessage = "Network error or timeout. The connection to the server was lost. Please check your internet and CORS configuration.";
              break;
          case 'storage/unknown':
              userFriendlyMessage = "An unknown error occurred, possibly a CORS configuration issue. Please verify your cors.json settings on the bucket.";
              break;
        }
        
        reject(new Error(userFriendlyMessage));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log('File available at', downloadURL);
          resolve(downloadURL);
        } catch (error: any) {
            console.error("Failed to get download URL:", error);
            reject(new Error(`Failed to get download URL: ${error.message}`));
        }
      }
    );
  });
};

export const getImageAsDataUrl = async (url: string): Promise<string> => {
    if (!url) return '';
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result as string);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error converting image to data URL:", error);
        return ''; // Return empty string on failure
    }
};
