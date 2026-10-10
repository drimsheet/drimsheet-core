export default interface IPasswordAppService {
  makePassword(input: unknown): string;
  hash(password: string): Promise<string>;
  compare(password: string, hashedPassword: string): Promise<boolean>;
}
