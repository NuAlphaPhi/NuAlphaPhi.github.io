/*
 * Firebase project config for the NAΦ Portal.
 *
 * How to fill this in:
 * 1. Create a free project at https://console.firebase.google.com
 * 2. Authentication -> Sign-in method -> enable Email/Password
 * 3. Build -> Firestore Database -> Create database (production mode) ->
 *    Rules tab -> paste the contents of /firestore.rules -> Publish
 * 4. Project settings -> General -> "Your apps" -> add a Web app -> copy the
 *    firebaseConfig object it gives you and paste the values below.
 *
 * These values are safe to commit / expose publicly — they identify your
 * Firebase project, they are not secret credentials. The Firestore security
 * rules (not hiding this config) are what actually protects your data.
 */
(function () {
  "use strict";

  var firebaseConfig = {
    apiKey: "AIzaSyATmDJcDtuVN1g9Ps-tstt5EI6NBP_kpuk",
    authDomain: "nualphaphi-6b330.firebaseapp.com",
    projectId: "nualphaphi-6b330",
    storageBucket: "nualphaphi-6b330.firebasestorage.app",
    messagingSenderId: "62821852877",
    appId: "1:62821852877:web:f0efed7b68e03faf2ceb84",
    measurementId: "G-QYZ9WYZMDS"
  };

  firebase.initializeApp(firebaseConfig);

  window.db = firebase.firestore();
  // Not every page that loads this shared config file also loads every
  // Firebase SDK script tag — blog.html is public/read-only and skips auth
  // entirely, portal-home.html is the only page that needs Storage. Guard
  // each one so a page missing that SDK doesn't throw on load.
  if (typeof firebase.auth === "function") {
    window.auth = firebase.auth();
  }
  if (typeof firebase.storage === "function") {
    window.storage = firebase.storage();
  }
})();
