import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch, resolveImageUrl } from "@/lib/api";

type Post = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  imageUrl: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "TBA";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const BlogPost = () => {
  const { id } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await apiFetch(`/api/posts/${id}`);
        if (!resp.ok) throw new Error("Failed to load post");
        setPost(await resp.json());
      } catch (err) {
        setError("Post not found.");
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {loading && <p className="text-muted-foreground">Loading post...</p>}
          {!loading && error && <p className="text-destructive">{error}</p>}

          {!loading && post && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{formatDate(post.publishedAt)}</Badge>
                <Link to="/events">
                  <Button variant="secondary" size="sm">
                    Back to Events
                  </Button>
                </Link>
              </div>
              <h1 className="font-display text-4xl tracking-wider">{post.title}</h1>
              {post.imageUrl && (
                <img
                  src={resolveImageUrl(post.imageUrl)}
                  alt={post.title}
                  className="w-full rounded-2xl border border-border object-cover"
                />
              )}
              {post.excerpt && <p className="text-muted-foreground text-lg">{post.excerpt}</p>}
              <div className="prose prose-invert max-w-none">
                {post.content ? (
                  post.content.split("\n").map((line, idx) => (
                    <p key={`${post.id}-${idx}`}>{line}</p>
                  ))
                ) : (
                  <p className="text-muted-foreground">No content yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPost;
