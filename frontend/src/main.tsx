import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SharedView from "./components/SharedView";
import "./index.css";

// A public share link (/s/<token>) opens the read-only page; everything else is the app.
const shareToken = window.location.pathname.match(/^\/s\/([^/]+)\/?$/)?.[1];

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{shareToken ? <SharedView token={shareToken} /> : <App />}</React.StrictMode>
);
