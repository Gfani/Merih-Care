import React, { useState } from "react";
import { Card, DataTable, Rating, StatusBadge, Button, toast } from "../components/ui";
import { reviews as mockReviews } from "../data/mock";

export default function ReviewsSection() {
  const [reviews, setReviews] = useState(mockReviews);

  const handleModerate = (id: string, approve: boolean) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status: approve ? "published" as const : "hidden" as const } : r));
    toast(approve ? "Review approved" : "Review hidden", "info");
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <DataTable
          columns={[
            { key: "reviewerName", header: "Reviewer" },
            { key: "providerName", header: "Provider" },
            { key: "rating", header: "Rating", render: (row) => <Rating value={row.rating as number} showCount={false} /> },
            { key: "comment", header: "Review", render: (row) => <p className="text-sm max-w-[200px] truncate text-[#4a5a6a]">{row.comment as string}</p> },
            { key: "service", header: "Service" },
            { key: "date", header: "Date", render: (row) => <span className="text-xs text-[#8a9aaa]">{row.date as string}</span> },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status === "flagged" ? "disputed" : (row.status as any)} /> },
            { key: "actions", header: "Actions", render: (row) => (
              <div className="flex gap-1">
                {row.status === "flagged" ? (
                  <>
                    <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2 text-[#16a34a]" onClick={() => handleModerate(row.id as string, true)}>Approve</Button>
                    <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2 text-[#dc2626]" onClick={() => handleModerate(row.id as string, false)}>Hide</Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2">View</Button>
                )}
              </div>
            )},
          ]}
          data={reviews as any}
        />
      </Card>
    </div>
  );
}
