import { FiPlus, FiHeart } from "react-icons/fi";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../utils/formatters";
import Rating from "../ui/Rating";

const PLACEHOLDER_IMAGE = "/placeholder-food.png";

export default function FoodCard({
  meal,
  onAdd,
  isFavourite,
  onToggleFavourite,
  layout = "grid",
}) {

  if (!meal) return null;


  if (layout === "row") {

    return (
      <div className="shrink-0 w-56 card overflow-hidden">

        <Link to={`/food/${meal.id}`}>
          <img
            src={meal.image || PLACEHOLDER_IMAGE}
            alt={meal.name}
            className="h-32 w-full object-cover"
          />
        </Link>


        <div className="p-3">

          <Link to={`/food/${meal.id}`}>

            <h4 className="text-sm font-semibold text-ink truncate">
              {meal.name}
            </h4>

            <p className="text-xs text-ink-muted">
              {meal.vendorName}
            </p>

          </Link>


          <div className="flex items-center justify-between mt-2">

            <span className="text-sm font-semibold text-nude-700">
              {formatCurrency(meal.price)}
            </span>


            <button
              onClick={() => onAdd?.(meal)}
              className="btn-icon !h-8 !w-8 !bg-ink !text-paper !border-ink"
              aria-label="Add to cart"
            >
              <FiPlus size={15}/>
            </button>


          </div>

        </div>

      </div>
    );

  }



  return (

    <div className="card overflow-hidden relative">


      <div className="relative">


        <Link to={`/food/${meal.id}`}>

          <img
            src={meal.image || PLACEHOLDER_IMAGE}
            alt={meal.name}
            className="h-40 w-full object-cover"
            loading="lazy"
          />

        </Link>



        {onToggleFavourite && (

          <button
            onClick={() => onToggleFavourite(meal)}
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-paper-raised/90 backdrop-blur flex items-center justify-center shadow-card"
            aria-label="Toggle favourite"
          >

            <FiHeart
              size={15}
              className={
                isFavourite
                ? "fill-danger text-danger"
                : "text-ink-soft"
              }
            />

          </button>

        )}



        {meal.tags?.[0] && (

          <span className="absolute bottom-2 left-2 badge">
            {meal.tags[0]}
          </span>

        )}


      </div>





      <div className="p-3.5">


        <Link to={`/food/${meal.id}`}>

          <h4 className="text-sm font-semibold text-ink truncate">
            {meal.name}
          </h4>


          <p className="text-xs text-ink-muted mt-0.5">
            {meal.vendorName}
          </p>


        </Link>





        {meal.rating > 0 && (

          <div className="mt-2">
            <Rating value={meal.rating}/>
          </div>

        )}





        <div className="flex items-center justify-between mt-3">


          <span className="text-sm font-semibold text-nude-700">
            {formatCurrency(meal.price)}
          </span>



          <button

            onClick={() => onAdd?.(meal)}

            className="btn-icon !h-8 !w-8 !bg-ink !text-paper !border-ink"

            aria-label="Add to cart"

          >

            <FiPlus size={15}/>

          </button>


        </div>


      </div>


    </div>

  );

}
