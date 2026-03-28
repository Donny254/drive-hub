import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActionConfirmDialog from "@/components/shared/ActionConfirmDialog";

describe("ActionConfirmDialog", () => {
  it("renders labels and calls confirm action", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ActionConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete listing?"
        description="This will permanently remove this listing."
        cancelLabel="Keep Listing"
        confirmLabel="Delete Listing"
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("Delete listing?")).toBeInTheDocument();
    expect(screen.getByText("This will permanently remove this listing.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep Listing" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete Listing" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows loading label and disables cancel while pending", () => {
    render(
      <ActionConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Cancel booking?"
        description="This will cancel booking #1234."
        cancelLabel="Keep Booking"
        confirmLabel="Cancel Booking"
        loading
        loadingLabel="Cancelling..."
        onConfirm={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: "Cancelling..." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep Booking" })).toBeDisabled();
  });
});
