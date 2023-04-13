/// <reference types="./custom-typings.d.ts" />
import bsky from '@atproto/api';
const { BskyAgent } = bsky;
import * as dotenv from 'dotenv';
import process from 'node:process';
import { search } from 'fast-fuzzy';
// import Fuse from 'fuse.js';
dotenv.config();

if (typeof process.argv[2] === 'undefined') {
  console.log('Please provide a search term');
  process.exit(1);
}

const agent = new BskyAgent({
  service: 'https://bsky.social',
});

await agent.login({
  identifier: process.env.BSKY_USERNAME!,
  password: process.env.BSKY_PASSWORD!,
});

// source: https://github.com/bluesky-social/atproto/blob/efb1cac2bfc8ccb77c0f4910ad9f3de7370fbebb/packages/bsky/tests/_util.ts#L314
const paginateAll = async <T extends { cursor?: string }>(
  fn: (cursor?: string) => Promise<T>,
  limit = Infinity,
): Promise<T[]> => {
  const results: T[] = [];
  let cursor;
  do {
    const res = await fn(cursor);
    results.push(res);
    cursor = res.cursor;
  } while (cursor && results.length < limit);
  return results;
};

// source: https://github.com/bluesky-social/atproto/blob/efb1cac2bfc8ccb77c0f4910ad9f3de7370fbebb/packages/bsky/tests/views/author-feed.test.ts#L94
const paginator = async (cursor?: string) => {
  const res = await agent.getAuthorFeed({
    actor: agent.session!.did,
    cursor,
    limit: 100,
  });
  return res.data;
};

const paginatedAll = await paginateAll(paginator);

const posts: object[] = [];

paginatedAll.forEach((res) => {
  if (typeof res.feed[0] !== 'undefined') {
    posts.push(
      ...res.feed.map((e) => ({
        text: (e.post.record as any).text,
        uri: e.post.uri.replace('app.bsky.feed.', '').replace('at://', 'https://staging.bsky.app/profile/'),
        likeCount: e.post.likeCount,
        did: e.post.author.did,
        isOwn: e.post.author.did === agent.session!.did,
        repostCount: e.post.repostCount,
        isRepost: e.post.repostCount === 0 ? false : true,
      })),
    );
  }
});

const pattern = process.argv[2];

if (pattern === 'topLikes') {
  posts.sort((a: any, b: any) => {
    return b.likeCount - a.likeCount;
  });
  const ownBestPosts = posts.filter((post: any) => {
    return post.isOwn === true && post.isRepost === false;
  });
  console.log(ownBestPosts.slice(0, 20));
  process.exit(0);
}

if (pattern === 'topRTs') {
  posts.sort((a: any, b: any) => {
    return b.repostCount - a.repostCount;
  });
  const ownBestPosts = posts.filter((post: any) => {
    return post.isOwn === true;
  });
  console.log(ownBestPosts.slice(0, 20));
  process.exit(0);
}

if (pattern === 'noText') {
  posts.sort((a: any, b: any) => {
    return b.likeCount - a.likeCount;
  });
  const ownBestImages = posts.filter((post: any) => {
    return post.text === '' && post.isOwn === true;
  });
  console.log(ownBestImages.slice(0, 20));
  process.exit(0);
}

// const options = {
//   // isCaseSensitive: false,
//   includeScore: true,
//   // shouldSort: true,
//   includeMatches: true,
//   findAllMatches: true,
//   // minMatchCharLength: 1,
//   // location: 0,
//   threshold: 0.3,
//   // distance: 100,
//   // useExtendedSearch: false,
//   // ignoreLocation: false,
//   // ignoreFieldNorm: false,
//   // fieldNormWeight: 1,
//   keys: ['text'],
// };

// const fuse = new Fuse(posts, options);

// Change the pattern

// console.log(
//   fuse.search(pattern).map((e) => {
//     return {
//       text: e.item.text,
//       uri: e.item.uri,
//       likeCount: e.item.likeCount,
//     };
//   }),
// );

const results = search(process.argv[2], posts, { keySelector: (o) => (o as any).text, returnMatchData: true });
console.log(results);
