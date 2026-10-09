import { useRequestGuard } from '../../hooks/useRequestGuard';
import { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  FiClock,
  FiMapPin,
  FiMessageCircle,
  FiShoppingBag,
} from "react-icons/fi";

import Navbar from "../../components/layout/Navbar";
import FoodCard from "../../components/features/FoodCard";
import Rating from "../../components/ui/Rating";
import Avatar from "../../components/ui/Avatar";

import { useAsync } from "../../hooks/useAsync";
import { vendorService } from "../../services/vendorService";
import { orderService } from "../../services/orderService";
import { chatService } from "../../services/chatService";

import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

import { formatRelativeTime } from "../../utils/formatters";
import { useDeliveryDate } from "../../hooks/useDeliveryDate";
import RequestError from "../../components/ui/RequestError";

const TABS = ["Menu", "Reviews", "About"];

export default function VendorProfile() {
  const deliveryDate = useDeliveryDate();
  const { id } = useParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState("Menu");
  const [openingChat, setOpeningChat] =
    useState(false);

  const { addItem } = useCart();
  const { showToast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const requests = useRequestGuard(`${user?.id}:${id}`);
  useEffect(() => { setOpeningChat(false); }, [id, user?.id]);

  const {
    data: vendor,
    loading: vendorLoading, error: vendorError, refetch: retryVendor,
  } = useAsync(
    () => vendorService.getVendorById(id),
    [id], null
  );

  const {
    data: menu = [],
    loading: menuLoading, error: menuError, refetch: retryMenu,
  } = useAsync(
    () =>
      vendorService.getVendorMenu(id, {
        forDate: deliveryDate,
      }),
    [id, deliveryDate]
  );

  const {
    data: reviews = [],
    loading: reviewsLoading, error: reviewsError, refetch: retryReviews,
  } = useAsync(
    () => vendorService.getVendorReviews(id),
    [id]
  );

  /*
   * We only need customer orders when a signed-in
   * customer is viewing a vendor.
   *
   * Existing chat security requires an OfficeBites
   * order between the customer and vendor.
   */
  const {
    data: customerOrders = [],
    loading: ordersLoading, error: ordersError, refetch: retryOrders,
  } = useAsync(
    () =>
      isAuthenticated && user?.id
        ? orderService.getOrdersByCustomer(user.id)
        : Promise.resolve([]),
    [isAuthenticated, user?.id]
  );

  const eligibleOrder = useMemo(() => {
    if (!isAuthenticated || !id) {
      return null;
    }

    /*
     * Prefer the newest order involving this vendor.
     * getOrdersByCustomer() already returns newest first.
     */
    return (
      customerOrders.find((order) =>
        order.subOrders?.some(
          (subOrder) => subOrder.vendorId === id
        )
      ) || null
    );
  }, [
    customerOrders,
    id,
    isAuthenticated,
  ]);

  const handleAdd = (meal) => {
    addItem(meal);

    showToast(`Added ${meal.name} to cart`, {
      type: "success",
    });
  };

  const handleMessageVendor = async () => {
    if (!isAuthenticated) {
      navigate("/login", {
        state: {
          from: {
            pathname: `/vendors/${id}`,
          },
        },
      });

      return;
    }

    if (ordersError) { showToast('Could not check messaging eligibility. Please retry.', { type: 'error' }); return; }
    if (!eligibleOrder) {
      showToast(
        "Messaging becomes available after you place an order with this vendor.",
        {
          type: "info",
        }
      );

      return;
    }

    if (openingChat) {
      return;
    }

    const current = requests.begin();
    try {
      setOpeningChat(true);

      const conversation =
        await chatService.startConversation({
          vendorId: id,
          orderId: eligibleOrder.id,
        });

      if (!current()) return;
      navigate(`/chat/${conversation.id}`);
    } catch (error) {
      if (!current()) return;
      console.error(
        "Couldn't open vendor conversation:",
        error
      );

      showToast(
        error.message ||
          "Couldn't open the conversation.",
        {
          type: "error",
        }
      );
    } finally {
      if (current()) setOpeningChat(false);
    }
  };

  const scrollToMenu = () => {
    setTab("Menu");

    window.setTimeout(() => {
      document
        .getElementById("vendor-content")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 0);
  };

  if (vendorError) return <RequestError error={vendorError} onRetry={retryVendor} />;
  if (vendorLoading) {
    return (
      <div>
        <Navbar showBack />

        <div className="ob-container pt-4">
          <div className="skeleton h-44 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl mt-3" />
        </div>
      </div>
    );
  }

  if (!vendor?.id) return <div><Navbar showBack /><p role="alert" className="ob-container pt-4">This vendor is unavailable.</p></div>;

  const locationLabel =
    vendor.address ||
    vendor.building ||
    "OfficeBites vendor";

  const hasCoverImage =
    vendor.coverImage &&
    !vendor.coverImage.startsWith("blob:");

  return (
    <div className="pb-8">
      <Navbar showBack transparent />

      {/* Storefront hero */}
      <div className="-mt-16 relative">
        {hasCoverImage ? (
          <img
            src={vendor.coverImage}
            alt={`${vendor.name} cover`}
            className="h-52 sm:h-60 w-full object-cover"
          />
        ) : (
          <div className="h-52 sm:h-60 w-full bg-gradient-to-br from-nude-100 via-nude-50 to-paper" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-ink/10" />
      </div>

      <div className="ob-container -mt-10 relative z-10">
        <div className="card p-4 sm:p-5 shadow-sm">
          <div className="flex items-start gap-3.5">
            <Avatar
              src={
                vendor.logo?.startsWith("blob:")
                  ? null
                  : vendor.logo
              }
              name={vendor.name}
              size={64}
              className="rounded-2xl !rounded-2xl ring-4 ring-paper"
            />

            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-xl font-bold text-ink leading-tight">
                {vendor.name}
              </h1>

              {vendor.tagline && (
                <p className="text-sm text-ink-muted mt-1 leading-relaxed">
                  {vendor.tagline}
                </p>
              )}

              <div className="mt-2">
                <Rating
                  value={vendor.rating}
                  count={vendor.reviewCount}
                />
              </div>
            </div>
          </div>

          {/* Business details */}
          <div className="grid gap-2 mt-4 pt-4 border-t border-line">
            <div className="flex items-start gap-2 text-xs text-ink-muted">
              <FiMapPin
                size={14}
                className="mt-0.5 shrink-0"
              />

              <span>{locationLabel}</span>
            </div>

            {vendor.operatingHours && (
              <div className="flex items-start gap-2 text-xs text-ink-muted">
                <FiClock
                  size={14}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  {vendor.operatingHours}
                </span>
              </div>
            )}
          </div>

          {/* Primary actions */}
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <button
              type="button"
              onClick={handleMessageVendor}
              disabled={
                openingChat ||
                (isAuthenticated && ordersLoading)
              }
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <FiMessageCircle size={16} />

              {openingChat
                ? "Opening..."
                : "Message vendor"}
            </button>

            <button
              type="button"
              onClick={scrollToMenu}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <FiShoppingBag size={16} />
              View menu
            </button>
          </div>

          {/* Explain chat eligibility */}
          {ordersError && <RequestError error={ordersError} onRetry={retryOrders} />}
          {isAuthenticated &&
            !ordersError && !ordersLoading &&
            !eligibleOrder && (
              <p className="text-[11px] text-ink-muted text-center mt-2.5 leading-relaxed">
                Messaging is available once you
                have an OfficeBites order with
                this vendor.
              </p>
            )}
        </div>
      </div>

      {/* Tabs */}
      <div
        id="vendor-content"
        className="ob-container mt-6 scroll-mt-20"
      >
        <div className="flex gap-6 border-b border-line">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === item
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="ob-container mt-4">
        {tab === "Menu" && (
          <div className="flex flex-col gap-3">
            {menuError ? <RequestError error={menuError} onRetry={retryMenu} /> : menuLoading ? (
              Array.from({
                length: 3,
              }).map((_, index) => (
                <div
                  key={index}
                  className="skeleton h-24"
                />
              ))
            ) : menu.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-sm font-semibold text-ink">
                  No meals available right now
                </p>

                <p className="text-xs text-ink-muted mt-1">
                  Check back for this vendor's
                  next available menu.
                </p>
              </div>
            ) : (
              menu.map((meal) => (
                <FoodCard
                  key={meal.id}
                  meal={meal}
                  onAdd={handleAdd}
                  layout="row"
                />
              ))
            )}
          </div>
        )}

        {tab === "Reviews" && (
          <div className="flex flex-col gap-4">
            {reviewsError ? <RequestError error={reviewsError} onRetry={retryReviews} /> : reviewsLoading ? (
              <div className="skeleton h-20" />
            ) : reviews.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-sm font-semibold text-ink">
                  No reviews yet
                </p>

                <p className="text-xs text-ink-muted mt-1">
                  Customer reviews will appear
                  here.
                </p>
              </div>
            ) : (
              reviews.map((review) => (
                <div
                  key={review.id}
                  className="card p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">
                      {review.customerName}
                    </span>

                    <Rating
                      value={review.rating}
                    />
                  </div>

                  {review.comment && (
                    <p className="text-sm text-ink-soft mt-2 leading-relaxed">
                      {review.comment}
                    </p>
                  )}

                  <p className="text-xs text-ink-muted mt-2">
                    {formatRelativeTime(
                      review.createdAt
                    )}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "About" && (
          <div className="card p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                About {vendor.name}
              </h2>

              <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">
                {vendor.tagline ||
                  `${vendor.name} is an OfficeBites food vendor serving customers in the local area.`}
              </p>
            </div>

            <div className="border-t border-line pt-4 flex flex-col gap-3">
              {vendor.category && (
                <div className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-ink-muted">
                    Category
                  </span>

                  <span className="text-ink font-medium text-right">
                    {vendor.category}
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between gap-4 text-sm">
                <span className="text-ink-muted">
                  Location
                </span>

                <span className="text-ink font-medium text-right">
                  {locationLabel}
                </span>
              </div>

              {vendor.operatingHours && (
                <div className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-ink-muted">
                    Hours
                  </span>

                  <span className="text-ink font-medium text-right">
                    {vendor.operatingHours}
                  </span>
                </div>
              )}

              {vendor.deliveryRadius && (
                <div className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-ink-muted">
                    Delivery area
                  </span>

                  <span className="text-ink font-medium text-right">
                    Up to{" "}
                    {vendor.deliveryRadius} km
                  </span>
                </div>
              )}

              {vendor.joinedAt && (
                <div className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-ink-muted">
                    On OfficeBites since
                  </span>

                  <span className="text-ink font-medium text-right">
                    {new Date(
                      vendor.joinedAt
                    ).toLocaleDateString(
                      "en-ZA",
                      {
                        month: "long",
                        year: "numeric",
                      }
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
