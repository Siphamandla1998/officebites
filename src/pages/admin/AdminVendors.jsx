import Filters from "../../components/ui/Filters";
import Table from "../../components/ui/Table";
import StatusBadge from "../../components/ui/StatusBadge";
import Avatar from "../../components/ui/Avatar";

import { useAsync } from "../../hooks/useAsync";
import { vendorService } from "../../services/vendorService";
import { useToast } from "../../context/ToastContext";

import { VENDOR_STATUS } from "../../utils/constants";

export default function AdminVendors() {

  const [filter, setFilter] = useState(
    VENDOR_STATUS.PENDING
  );

  const { showToast } = useToast();


  const {
    data: vendors = [],
    loading,
    refetch,
  } = useAsync(
    () =>
      vendorService.getVendors({
        status:
          filter === "all"
            ? undefined
            : filter,
      }),
    [filter]
  );



  const act = async (
    fn,
    vendor,
    label
  ) => {

    try {

      await fn(vendor.id);

      showToast(
        `${vendor.name} ${label}`,
        {
          type: "success",
        }
      );

      refetch();

    } catch(error){

      showToast(
        error.message ||
        "Action failed",
        {
          type:"error",
        }
      );

    }

  };



  const columns = [

    {
      key:"vendor",
      header:"Vendor",

      render:(v)=>(

        <div className="flex items-center gap-3">

          <Avatar
            src={v.logo}
            name={v.name}
          />

          <div>

            <div className="font-medium">
              {v.name}
            </div>

            <div className="text-xs text-ink-muted">
              {v.category}
            </div>

          </div>

        </div>

      ),
    },


    {
      key:"building",
      header:"Building",

      render:(v)=>
        v.building || "-"
    },


    {
      key:"tier",
      header:"Plan",

      render:(v)=>
        v.subscriptionTier || "-"
    },


    {
      key:"status",
      header:"Status",

      render:(v)=>(

        <StatusBadge
          status={v.status}
        />

      ),
    },


    {
      key:"actions",
      header:"",

      render:(v)=>(

        <div className="flex gap-2">


          {
            v.status === VENDOR_STATUS.PENDING && (

              <>

                <button
                  onClick={() =>
                    act(
                      vendorService.approveVendor,
                      v,
                      "approved"
                    )
                  }
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                >
                  Approve
                </button>


                <button
                  onClick={() =>
                    act(
                      vendorService.rejectVendor,
                      v,
                      "rejected"
                    )
                  }
                  className="btn-outline !px-3 !py-1.5 text-xs !text-danger !border-danger/30"
                >
                  Reject
                </button>

              </>

            )
          }



          {
            v.status === VENDOR_STATUS.APPROVED && (

              <button
                onClick={() =>
                  act(
                    vendorService.suspendVendor,
                    v,
                    "suspended"
                  )
                }
                className="btn-outline !px-3 !py-1.5 text-xs"
              >
                Suspend
              </button>

            )
          }



          {
            v.status !== VENDOR_STATUS.PENDING &&
            v.status !== VENDOR_STATUS.APPROVED &&
            "-"
          }


        </div>

      ),
    },

  ];



  return (

    <div className="ob-container py-6">


      <div className="mb-5">

        <h1 className="text-xl font-semibold">
          Vendors
        </h1>

        <p className="text-sm text-ink-muted">
          Approve new vendors and manage existing ones.
        </p>

      </div>



      <Filters

        options={[
          VENDOR_STATUS.PENDING,
          VENDOR_STATUS.APPROVED,
          VENDOR_STATUS.SUSPENDED,
          VENDOR_STATUS.REJECTED,
        ]}

        active={filter}

        onChange={setFilter}

        allLabel="All vendors"

        labels={{
          [VENDOR_STATUS.PENDING]:
            "Pending review",

          [VENDOR_STATUS.APPROVED]:
            "Approved",

          [VENDOR_STATUS.SUSPENDED]:
            "Suspended",

          [VENDOR_STATUS.REJECTED]:
            "Rejected",
        }}

      />



      <div className="mt-5">

        {
          loading ? (

            <div className="text-sm text-ink-muted">
              Loading vendors...
            </div>

          ) : (

            <Table
              columns={columns}
              data={vendors}
            />

          )
        }

      </div>


    </div>

  );

}
