# To Do List

A simple To Do List web app using HTML-CSS-JS and Firebase

## Backend

This web app utilizes Javascript connected to Firebase as a backend. This means that all data will be saved into a database in the cloud, and an internet service is required to interact with the application.

## Usage

To use the web app, you must first create a Firebase project and set up a Firestore database through [this website](https://console.firebase.google.com/). You must then get the project configuration details and replace the placeholders in the `firebase-config.js` file.

```
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  // ...etc
};
```

You can then create a local server on your computer and access the web app through the `index.html` file.