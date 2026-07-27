import Table from "../../components/ui/Table";
import Avatar from "../../components/ui/Avatar";
import { useAsync } from "../../hooks/useAsync";
import { adminService } from "../../services/adminService";
import { useToast } from "../../context/ToastContext";

export default function AdminCustomers() {
  const { showToast } = useToast();
  const { data: customers, loading, refetch } = useAsync(() => adminService.getCustomers(), []);

  const suspend = async (c) => {
    await adminService.suspendCustomer(c.id);
    showToast(`${c.name} suspended`, { type: "info" });
    refetch();
  };

  const columns = [
    {
      key: "customer",
      header: "Customer",
      render: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={c.avatar} name={c.name} size={32} />
          <div>
            <p className="font-medium text-ink">{c.name}</p>
            <p className="text-xs text-ink-muted">{c.email}</p>
          </div>
        </div>
      ),
    },
    { key: "building", header: "Building", render: (c) => c.building || "—" },
    { key: "favourites", header: "Favourites", render: (c) => c.favouriteMealIds?.length || 0 },
    {
      key: "actions",
      header: "",
      render: (c) =>
        c.suspended ? (
          <span className="text-xs text-danger font-medium">Suspended</span>
        ) : (
          <button onClick={() => suspend(c)} className="btn-outline !px-3 !py-1.5 text-xs !text-danger !border-danger/30">
            Suspend
          </button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Customers</h1>
        <p className="text-sm text-ink-muted mt-0.5">View and manage customer accounts.</p>
      </div>
      {loading ? <div className="skeleton h-64" /> : <Table columns={columns} data={customers} />}
    </div>
  );
}
