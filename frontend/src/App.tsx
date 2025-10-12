import { useEffect, useState } from "react";
import { api } from "./lib/apiClient";

function App() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.get("../") // root endpoint (since your home is at '/')
      .then((res) => setMessage(res.data.message))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>ExamSync V2 Frontend</h1>
      <p>Backend says: {message || "Loading..."}</p>
    </div>
  );
}

export default App;
