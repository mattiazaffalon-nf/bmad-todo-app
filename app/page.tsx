import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { TodoListClient } from "@/components/TodoListClient";
import { getTodos } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["todos"],
    queryFn: () => getTodos(null),
  });

  return (
    <main className="flex flex-1 flex-col items-center bg-background">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TodoListClient />
      </HydrationBoundary>
    </main>
  );
}
