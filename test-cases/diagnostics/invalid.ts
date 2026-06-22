interface Account {
  id: number;
  owner: string;
}

const count: number = "not-a-number";
const account: Account = { id: 42 };

function acceptsText(value: string): string {
  return value.toUpperCase();
}

acceptsText(123);

export { account, count };
