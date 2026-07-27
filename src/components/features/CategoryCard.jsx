import { Link } from "react-router-dom";

export default function CategoryCard({ category }) {
  return (
    <Link
      to={`/categories/${category.id}`}
      className="shrink-0 w-20 flex flex-col items-center gap-2"
    >
      <div
        className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl"
        style={{ backgroundColor: category.color }}
      >
        {category.emoji}
      </div>
      <span className="text-[11px] font-medium text-ink-soft text-center leading-tight">
        {category.name}
      </span>
    </Link>
  );
}
