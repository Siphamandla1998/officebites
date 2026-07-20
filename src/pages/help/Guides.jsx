import { Link } from "react-router-dom";
import { FiChevronRight, FiBookOpen } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import { useAsync } from "../../hooks/useAsync";
import { supportService } from "../../services/supportService";

export default function Guides() {
  const { data: guides, loading } = useAsync(() => supportService.getGuides(), []);

  return (
    <div className="pb-8">
      <Navbar showBack title="Guides" showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16" />)
        ) : (
          guides.map((g) => (
            <Link key={g.id} to={`/help/guides/${g.id}`} className="card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-nude-100 text-nude-700 flex items-center justify-center shrink-0">
                <FiBookOpen size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{g.title}</p>
                <p className="text-xs text-ink-muted truncate">{g.summary}</p>
              </div>
              <FiChevronRight size={16} className="text-ink-muted shrink-0" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
