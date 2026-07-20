import { useState } from "react";
import Filters from "../../components/ui/Filters";
import Table from "../../components/ui/Table";
import StatusBadge from "../../components/ui/StatusBadge";
import Avatar from "../../components/ui/Avatar";
import { useAsync } from "../../hooks/useAsync";
import { vendorService } from "../../services/vendorService";
import { useToast } from "../../context/ToastContext";
import { VENDOR_STATUS } from "../../utils/constants";

export default function AdminVendors() {
  const [filter, setFilter] = useState(VENDOR_STATUS.PENDING);
  const { showToast } = useToast();
  const { data: vendors, loading, refetch } = useAsync(
    () => vendorService.getVendors({ status: filter === "all" ? undefined : filter }),
    [filter]
  );

  const act = async (fn, vendor, label) => {
    await fn(vendor.id);
    showToast(`${vendor.name} ${label}`, { type: "success" });
    refetch();
  };

  const columns = [
    {
      key: "vendor",
      header: "Vendor",
      render: (v) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={v.logo} name={v.name} size={32} />
          <div>
            <p className="font-medium text-ink">{v.name}</p>
            <p className="text-xs text-ink-muted">{v.category}</p>
          </div>
        </div>
      ),
    },
    { key: "building", header: "Building", render: (v) => v.building },
    { key: "tier", header: "Plan", render: (v) => <span className="capitalize">{v.subscriptionTier}</span> },
    { key: "status", header: "Status", render: (v) => <StatusBadge status={v.status} /> },
    {
      key: "actions",
      header: "",
      render: (v) =>
        v.status === VENDOR_STATUS.PENDING ? (
          <div className="flex gap-2">
            <button
              onClick={() => act(vendorService.approveVendor, v, "approved")}
              className="btn-secondary !px-3 !py-1.5 text-xs"
            >
              Approve
            </button>
            <button
              onClick={() => act(vendorService.rejectVendor, v, "rejected")}
              className="btn-outline !px-3 !py-1.5 text-xs !text-danger !border-danger/30"
            >
              Reject
            </button>
          </div>
        ) : v.status === VENDOR_STATUS.APPROVED ? (
          <button
            onClick={() => act(vendorService.suspendVendor, v, "suspended")}
            className="btn-outline !px-3 !py-1.5 text-xs"
          >
            Suspend
          </button>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Vendors</h1>
        <p className="text-sm text-ink-muted mt-0.5">Approve new vendors and manage existing ones.</p>
      </div>
      <Filters
        options={[VENDOR_STATUS.PENDING, VENDOR_STATUS.APPROVED, VENDOR_STATUS.SUSPENDED, VENDOR_STATUS.REJECTED]}
        active={filter}
        onChange={setFilter}
        allLabel="All vendors"
        labels={{
          [VENDOR_STATUS.PENDING]: "Pending review",
          [VENDOR_STATUS.APPROVED]: "Approved",
          [VENDOR_STATUS.SUSPENDED]: "Suspended",
          [VENDOR_STATUS.REJECTED]: "Rejected",
        }}
      />
      {loading ? <div className="skeleton h-64" /> : <Table columns={columns} data={vendors} emptyLabel="No vendors in this state" />}
    </div>
  );
}
