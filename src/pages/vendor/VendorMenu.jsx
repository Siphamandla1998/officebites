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


const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80";


export default function VendorMenu() {

  const { user } = useAuth();
  const { showToast } = useToast();


  const {
    data: menu = [],
    loading,
    refetch,
  } = useAsync(
    () => vendorService.getVendorMenu(user.vendorId),
    [user.vendorId]
  );


  const [formOpen,setFormOpen] = useState(false);
  const [editingMeal,setEditingMeal] = useState(null);
  const [saving,setSaving] = useState(false);



  const openAdd = ()=>{
    setEditingMeal(null);
    setFormOpen(true);
  };


  const openEdit = (meal)=>{
    setEditingMeal(meal);
    setFormOpen(true);
  };



  const handleSave = async(formData)=>{

    try{

      setSaving(true);


      if(editingMeal){

        await vendorService.updateMeal(
          editingMeal.id,
          {
            ...formData,
            vendorId:user.vendorId
          }
        );


        showToast(
          `${formData.name} updated`,
          {
            type:"success"
          }
        );


      }else{


        await vendorService.addMeal(
          user.vendorId,
          formData
        );


        showToast(
          `${formData.name} added`,
          {
            type:"success"
          }
        );

      }


      setFormOpen(false);
      refetch();


    }catch(error){

      showToast(
        error.message || "Unable to save meal",
        {
          type:"error"
        }
      );


    }finally{

      setSaving(false);

    }

  };




  const handleDelete = async(meal)=>{


    const confirmDelete =
      window.confirm(
        `Remove "${meal.name}" from menu?`
      );


    if(!confirmDelete) return;


    try{

      await vendorService.deleteMeal(meal.id);


      showToast(
        `${meal.name} removed`,
        {
          type:"info"
        }
      );


      refetch();


    }catch(error){

      showToast(
        error.message,
        {
          type:"error"
        }
      );

    }

  };




  const toggleAvailability = async(meal)=>{

    await vendorService.updateMealAvailability(
      meal.id,
      !meal.available
    );


    showToast(
      meal.available
      ?"Marked sold out"
      :"Marked available",
      {
        type:"info"
      }
    );


    refetch();

  };



  const toggleFeatured = async(meal)=>{

    await vendorService.updateMealFeatured(
      meal.id,
      !meal.featured
    );


    refetch();

  };





return (

<div className="space-y-5">


<div className="flex justify-between items-center">

<div>
<h2 className="text-xl font-semibold">
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
<FiPlus size={15}/>
Add meal
</button>


</div>





{
loading ? (

<div className="skeleton h-64"/>

)

:

menu.length===0 ? (

<EmptyState

icon={<FiShoppingBag size={20}/>}

title="Your menu is empty"

description="Add your first meal to start receiving orders."

action={
<button
onClick={openAdd}
className="btn-primary"
>
<FiPlus size={15}/>
Add meal
</button>
}

/>

)

:

(

<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">


{
menu.map(meal=>(


<div
key={meal.id}
className="card overflow-hidden"
>


<div className="relative">


<img

src={meal.image || FALLBACK_IMAGE}

alt={meal.name}

className="h-36 w-full object-cover"

/>



<div className="absolute top-2 right-2 flex gap-2">


<button

onClick={()=>toggleFeatured(meal)}

className={
`btn-icon h-8 w-8 ${
meal.featured
?"bg-nude-500 text-white"
:""
}`
}

>

<FiStar size={14}/>

</button>



<button

onClick={()=>openEdit(meal)}

className="btn-icon h-8 w-8"

>

<FiEdit2 size={14}/>

</button>



<button

onClick={()=>handleDelete(meal)}

className="btn-icon h-8 w-8 text-danger"

>

<FiTrash2 size={14}/>

</button>



</div>


</div>





<div className="p-4">


<h3 className="font-semibold">
{meal.name}
</h3>


<p className="text-xs text-ink-muted">
{meal.category}
</p>


<p className="font-semibold text-nude-700 mt-2">

{formatCurrency(meal.price)}

</p>




<div className="flex justify-between items-center mt-4">


<span className="text-xs">
{
meal.available
?"Available"
:"Sold out"
}
</span>



<button

onClick={()=>toggleAvailability(meal)}

className={
`h-6 w-11 rounded-full ${
meal.available
?"bg-ink"
:"bg-nude-200"
}`
}

>

<span
className={
`block h-5 w-5 bg-white rounded-full mt-0.5 transition ${
meal.available
?"translate-x-5"
:"translate-x-0.5"
}`
}
/>

</button>



</div>



</div>


</div>


))

}


</div>

)

}



<MealFormModal

open={formOpen}

onClose={()=>setFormOpen(false)}

onSave={handleSave}

meal={editingMeal}

saving={saving}

/>


</div>

);

}
