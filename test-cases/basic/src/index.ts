type Brand<T, Name extends string> = T & { readonly __brand: Name };
type UserId = Brand<number, "UserId">;
type ApiRoute<Resource extends string> = `/api/${Resource}/${number}`;
type AwaitedValue<T> = T extends Promise<infer Value> ? Value : T;

interface User {
  readonly id: UserId;
  name: string;
  tags: readonly string[];
  profile?: {
    locale: string;
    emoji: "🚀" | "🧪";
  };
}

function makeUser(id: number, name: string): User {
  return {
    id: id as UserId,
    name,
    tags: ["typescript", "qa"],
    profile: { locale: "en", emoji: "🧪" }
  };
}

function routeFor(user: User): ApiRoute<"users"> {
  return `/api/users/${user.id}`;
}

async function loadUser(): Promise<User> {
  return makeUser(7, "Ada");
}

type LoadedUser = AwaitedValue<ReturnType<typeof loadUser>>;

const user: LoadedUser = await loadUser();
const firstTag = user.tags[0] ?? "untagged";

export const fixtureSummary = {
  route: routeFor(user),
  label: `${user.name}:${firstTag}`,
  emoji: user.profile?.emoji ?? "🚀"
} as const;
