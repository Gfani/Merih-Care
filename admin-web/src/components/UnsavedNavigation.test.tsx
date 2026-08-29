import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useState } from "react";

// Mock component simulating unsaved form state guard
function SampleFormWithNavigationGuard({ onNavigate }: { onNavigate: () => void }) {
  const [isDirty, setIsDirty] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const handleAttemptNavigate = () => {
    if (isDirty) {
      setShowWarning(true);
    } else {
      onNavigate();
    }
  };

  return (
    <div>
      <input
        placeholder="Edit configuration..."
        onChange={() => setIsDirty(true)}
      />
      <button onClick={handleAttemptNavigate}>Navigate Away</button>
      {showWarning && (
        <div role="alert" className="modal">
          <p>You have unsaved changes. Are you sure you want to leave?</p>
          <button onClick={() => setShowWarning(false)}>Stay on Page</button>
          <button onClick={onNavigate}>Discard & Leave</button>
        </div>
      )}
    </div>
  );
}

describe("Admin Web - Unsaved Navigation Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow navigation without prompt when form is pristine", () => {
    const onNavigate = vi.fn();
    render(<SampleFormWithNavigationGuard onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: /Navigate Away/i }));
    expect(onNavigate).toHaveBeenCalled();
  });

  it("should intercept navigation and display warning prompt when form has unsaved edits", () => {
    const onNavigate = vi.fn();
    render(<SampleFormWithNavigationGuard onNavigate={onNavigate} />);

    // Make an edit to dirty the form
    const input = screen.getByPlaceholderText(/Edit configuration/i);
    fireEvent.change(input, { target: { value: "Changed value" } });

    // Attempt to navigate away
    fireEvent.click(screen.getByRole("button", { name: /Navigate Away/i }));

    // Warning prompt should appear
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();

    // User chooses to discard and leave
    fireEvent.click(screen.getByRole("button", { name: /Discard & Leave/i }));
    expect(onNavigate).toHaveBeenCalled();
  });
});
