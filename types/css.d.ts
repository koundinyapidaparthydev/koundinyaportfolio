// CSS module and global CSS type declarations for TypeScript
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}
