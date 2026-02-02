import React, { useState, useEffect } from "react";
import { Logo } from "./components/logo";

interface HealthStatus {
  status: string;
  timestamp: string;
}

export function App(): React.ReactElement {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: HealthStatus) => setHealth(data))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <Logo />
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {health && (
        <div>
          <p>
            API Status: <strong style={{ color: "green" }}>{health.status}</strong>
          </p>
          <p>Timestamp: {health.timestamp}</p>
        </div>
      )}
      {!health && !error && <p>Loading...</p>}
    </div>
  );
}
