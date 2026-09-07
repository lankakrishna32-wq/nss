// Firebase configuration and Firestore synchronization for NSS SRGEC
(function() {
  const firebaseConfig = {
    apiKey: "AIzaSyCv7myQqinxUM2MXXS_qx5tCbDJbOS4yH8",
    authDomain: "nss-srgec-website.firebaseapp.com",
    projectId: "nss-srgec-website",
    storageBucket: "nss-srgec-website.firebasestorage.app",
    messagingSenderId: "211128945404",
    appId: "1:211128945404:web:e94ef400fcb74a618ae579"
  };

  let db = null;
  let isFirebaseReady = false;

  try {
    if (typeof firebase !== "undefined") {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      isFirebaseReady = true;
      console.log("Firebase Firestore initialized successfully.");
    } else {
      console.warn("Firebase SDK not loaded on this page.");
    }
  } catch (err) {
    console.error("Firebase init error:", err);
  }

  // Helper: compress image file or data URL to web-optimized data URL (max 1000px, 0.75 quality)
  // Keeps document size well within Firestore 1MB limits while maintaining great photo quality
  function compressImage(source, maxWidth = 1000, maxHeight = 1000, quality = 0.75) {
    return new Promise((resolve, reject) => {
      if (!source) return resolve("");

      function processImgSrc(src) {
        const img = new Image();
        img.onerror = () => resolve(src); // fallback to original on error
        img.onload = function() {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Return compressed JPEG data URL
          const compressed = canvas.toDataURL("image/jpeg", quality);
          resolve(compressed);
        };
        img.src = src;
      }

      if (typeof source === "string") {
        if (source.startsWith("data:image")) {
          processImgSrc(source);
        } else {
          // Regular URL or path, keep as is
          resolve(source);
        }
      } else if (source instanceof Blob || source instanceof File) {
        const reader = new FileReader();
        reader.onerror = () => resolve("");
        reader.onload = (e) => processImgSrc(e.target.result);
        reader.readAsDataURL(source);
      } else {
        resolve("");
      }
    });
  }

  // Fetch full data from Firestore. If empty, seeds from site.json or local.
  async function fetchFirestoreData() {
    if (!db) return null;

    try {
      const docRef = db.collection("site_data").doc("content");
      const snap = await docRef.get();

      if (snap.exists) {
        const data = snap.data();
        if (data && data.version) {
          return data;
        }
      }
      return null;
    } catch (err) {
      console.error("Failed to read from Firestore:", err);
      return null;
    }
  }

  // Save entire site data to Firestore
  async function saveFirestoreData(data) {
    if (!db) {
      console.warn("Firestore not available to save data.");
      return false;
    }

    try {
      data.lastUpdated = new Date().toISOString();
      const docRef = db.collection("site_data").doc("content");
      await docRef.set(data, { merge: true });
      console.log("Successfully saved data to Cloud Firestore!");
      return true;
    } catch (err) {
      console.error("Error saving to Cloud Firestore:", err);
      throw err;
    }
  }

  // Save a new volunteer registration to Firestore
  async function submitRegistrationToFirestore(regData) {
    if (!db) return false;
    try {
      regData.createdAt = new Date().toISOString();
      // Add to registrations collection
      await db.collection("registrations").add(regData);

      // Also append to the main content document for backwards compatibility
      const docRef = db.collection("site_data").doc("content");
      const snap = await docRef.get();
      if (snap.exists) {
        const d = snap.data() || {};
        const regs = d.registrations || [];
        regs.unshift(regData);
        await docRef.update({ registrations: regs });
      }
      return true;
    } catch (err) {
      console.error("Error submitting registration to Firestore:", err);
      return false;
    }
  }

  // Setup real-time listener for Firestore updates
  function listenToFirestore(callback) {
    if (!db) return () => {};

    try {
      const docRef = db.collection("site_data").doc("content");
      return docRef.onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          if (data && data.version) {
            callback(data);
          }
        }
      }, (error) => {
        console.warn("Firestore snapshot listener error:", error);
      });
    } catch (err) {
      console.warn("Could not attach Firestore listener:", err);
      return () => {};
    }
  }

  // Export to global window
  window.NssFirebase = {
    isReady: () => isFirebaseReady,
    getDb: () => db,
    compressImage: compressImage,
    fetchData: fetchFirestoreData,
    saveData: saveFirestoreData,
    submitRegistration: submitRegistrationToFirestore,
    listen: listenToFirestore
  };
})();
