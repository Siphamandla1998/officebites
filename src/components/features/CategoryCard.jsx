import { Link } from "react-router-dom";

export default function CategoryCard({ category }) {

  if (!category) return null;


  return (
    <Link
      to={`/categories/${category.id}`}
      className="shrink-0 w-20 flex flex-col items-center gap-2"
    >

      <div
        className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl"
        style={{
          backgroundColor: category.color || "#eee"
        }}
      >
        {category.emoji || "🍽️"}
      </div>


      <span className="text-xs text-center text-ink">
        {category.name}
      </span>


    </Link>
  );
}
