import { useState } from "react";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiStar,
  FiShoppingBag,
} from "react-icons/fi";

import { useAsync } from "../../hooks/useAsync";
import { vendorService } from "../../services/vendorService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { formatCurrency } from "../../utils/formatters";

import MealFormModal from "../../components/features/MealFormModal";
import EmptyState from "../../components/ui/EmptyState";


const PLACEHOLDER_IMAGE = "/placeholder-food.png";


export default function VendorMenu() {

  const { user } = useAuth();
  const { showToast } = useToast();


  const {
    data: menu = [],
    loading,
    refetch,
  } = useAsync(
    () =>
      user?.vendorId
        ? vendorService.getVendorMenu(user.vendorId)
        : [],
    [user?.vendorId]
  );


  const [formOpen, setFormOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [saving, setSaving] = useState(false);



  const openAdd = () => {
    setEditingMeal(null);
    setFormOpen(true);
  };


  const openEdit = (meal) => {
    setEditingMeal(meal);
    setFormOpen(true);
  };



  const handleSave = async (formData) => {

    setSaving(true);

    try {

      if (editingMeal) {

        await vendorService.updateMeal(
          editingMeal.id,
          formData
        );

        showToast(
          `${formData.name} updated`,
          { type: "success" }
        );

      } else {

        await vendorService.addMeal(
          user.vendorId,
          formData
        );

        showToast(
          `${formData.name} added to your menu`,
          { type: "success" }
        );

      }


      setFormOpen(false);
      refetch();


    } catch (err) {

      showToast(
        err.message || "Couldn't save meal",
        { type: "error" }
      );


    } finally {

      setSaving(false);

    }

  };



  const handleDelete = async (meal) => {

    if (
      !window.confirm(
        `Remove "${meal.name}" from your menu? This can't be undone.`
      )
    ) return;


    try {

      await vendorService.deleteMeal(meal.id);

      showToast(
        `${meal.name} removed`,
        { type: "success" }
      );

      refetch();


    } catch (err) {

      showToast(
        err.message || "Couldn't delete meal",
        { type: "error" }
      );

    }

  };



  const toggleAvailability = async (meal) => {

    try {

      await vendorService.updateMealAvailability(
        meal.id,
        !meal.available
      );


      showToast(
        `${meal.name} marked ${
          !meal.available
            ? "available"
            : "sold out"
        }`,
        { type: "info" }
      );


      refetch();


    } catch (err) {

      showToast(
        err.message || "Couldn't update availability",
        { type: "error" }
      );

    }

  };



  const toggleFeatured = async (meal) => {

    try {

      await vendorService.updateMealFeatured(
        meal.id,
        !meal.featured
      );


      showToast(
        `${meal.name} ${
          !meal.featured
            ? "featured"
            : "unfeatured"
        }`,
        { type: "info" }
      );


      refetch();


    } catch (err) {

      showToast(
        err.message || "Couldn't update featured status",
        { type: "error" }
      );

    }

  };



  return (

    <div className="space-y-5">


      <div className="flex items-center justify-between">

        <div>
          <h2 className="text-xl font-semibold text-ink">
            Menu
          </h2>

          <p className="text-sm text-ink-muted">
            Manage what customers can order today.
          </p>
        </div>


        <button
          onClick={openAdd}
          className="btn-primary"
        >
          <FiPlus size={15} />
          Add meal
        </button>


      </div>



      {
        loading ? (

          <div className="skeleton h-64" />

        ) : menu.length === 0 ? (

          <EmptyState
            icon={
              <FiShoppingBag size={20} />
            }
            title="Your menu is empty"
            description="Add your first meal to start receiving orders."
            action={
              <button
                onClick={openAdd}
                className="btn-primary"
              >
                <FiPlus size={15} />
                Add meal
              </button>
            }
          />

        ) : (


          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">


            {menu.map((meal) => (

              <div
                key={meal.id}
                className="card overflow-hidden"
              >


                <div className="relative">


                  <img
                    src={
                      meal.image ||
                      PLACEHOLDER_IMAGE
                    }
                    alt={meal.name}
                    className="h-32 w-full object-cover"
                  />



                  <div className="absolute top-2 right-2 flex gap-1.5">


                    <button
                      onClick={() => toggleFeatured(meal)}
                      className={`btn-icon !h-8 !w-8 ${
                        meal.featured
                          ? "!bg-nude-500 !text-paper !border-nude-500"
                          : ""
                      }`}
                    >
                      <FiStar size={13}/>
                    </button>



                    <button
                      onClick={() => openEdit(meal)}
                      className="btn-icon !h-8 !w-8"
                    >
                      <FiEdit2 size={13}/>
                    </button>



                    <button
                      onClick={() => handleDelete(meal)}
                      className="btn-icon !h-8 !w-8 !text-danger"
                    >
                      <FiTrash2 size={13}/>
                    </button>


                  </div>


                  {
                    meal.featured && (
                      <span className="absolute bottom-2 left-2 badge bg-nude-500 text-paper">
                        Featured
                      </span>
                    )
                  }


                </div>




                <div className="p-3.5">


                  <h4 className="text-sm font-semibold text-ink truncate">
                    {meal.name}
                  </h4>


                  <p className="text-xs text-ink-muted">
                    {meal.category}
                  </p>


                  <p className="text-sm font-semibold text-nude-700 mt-1">
                    {formatCurrency(meal.price)}
                  </p>



                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">


                    <span className="text-xs text-ink-muted">
                      {meal.available
                        ? "Available"
                        : "Sold out"}
                    </span>



                    <button
                      onClick={() =>
                        toggleAvailability(meal)
                      }
                      className={`h-6 w-11 rounded-full relative ${
                        meal.available
                          ? "bg-ink"
                          : "bg-nude-200"
                      }`}
                    >

                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper-raised shadow ${
                          meal.available
                            ? "translate-x-5"
                            : "translate-x-0.5"
                        }`}
                      />

                    </button>


                  </div>


                </div>


              </div>

            ))}


          </div>

        )
      }




      <MealFormModal

        open={formOpen}

        onClose={() =>
          setFormOpen(false)
        }

        onSave={handleSave}

        meal={editingMeal}

        saving={saving}

      />


    </div>

  );

}
