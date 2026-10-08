import { useParams } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import { useAsync } from "../../hooks/useAsync";
import { supportService } from "../../services/supportService";

export default function GuideDetail() {
  const { id } = useParams();
  const { data: guide, loading, error } = useAsync(() => supportService.getGuideById(id), [id], null);

  if (loading) {
    return (
      <div>
        <Navbar showBack showCart={false} />
        <div className="ob-container pt-4"><div className="skeleton h-48" /></div>
      </div>
    );
  }

  if (error || !guide?.id) {
    return <div><Navbar showBack showCart={false} /><p role="alert" className="ob-container pt-4">This guide is unavailable.</p></div>;
  }

  return (
    <div className="pb-8">
      <Navbar showBack title={guide.title} showCart={false} />
      <div className="ob-container pt-4">
        <div className="card p-5">
          <p className="text-sm text-ink-soft leading-relaxed">{guide.body}</p>
        </div>
      </div>
    </div>
  );
}
