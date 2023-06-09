const { AuthenticationError } = require('apollo-server');
const { ApolloError } = require('apollo-server-errors');
const ObjectID = require('mongodb').ObjectID;

const Post = require('../../Models/Post');
const checkAuth = require('../../utils/check-auth');

module.exports = {
  Query: {
    async getPosts(_, { page, tag, search, featured }) {
      let perPage = 4;
      page = Math.abs(page) || 1; // if pageNumber is not passed
      page = Math.max(1, page);
      try {
        let totalPostCount;
        let posts;
        if (tag) {
          page = 1;
          posts = await Post.find({
            'question.tags': { $elemMatch: { name: tag } },
            featured: featured,
          })
            .limit(perPage)
            .skip(perPage * (page - 1));
          totalPostCount = await Post.find({
            'question.tags': { $elemMatch: { name: tag } },
            featured: featured,
          }).count();
        } else if (search) {
          page = 1;
          posts = await Post.find({
            'question.title': { $regex: search, $options: 'i' },
            featured: featured,
          })
            .limit(perPage)
            .skip(perPage * (page - 1));
          totalPostCount = await Post.find({
            'question.title': { $regex: search, $options: 'i' },
            featured: featured,
          }).count();
        } else {
          posts = await Post.find({ featured: featured })
            .limit(perPage)
            .skip(perPage * (page - 1));
          totalPostCount = await Post.find({ featured: featured }).count();
        }
        const result = {
          posts,
          totalPages: Math.ceil(totalPostCount / perPage),
          totalPosts: totalPostCount,
        };
        return result;
      } catch (err) {
        throw new Error(err);
      }
    },
    async getPost(_, { postId }) {
      try {
        const post = await Post.findById(postId);
        if (post) {
          return post;
        } else {
          throw new ApolloError(
            'Post not found please check again',
            'POST_NOT_FOUND'
          );
        }
      } catch (err) {
        throw new ApolloError(
          'Post not found please check again',
          'POST_NOT_FOUND'
        );
      }
    },
    async getUserPost(_, { userId, page }) {
      let perPage = 4;
      page = Math.abs(page) || 1; // if pageNumber is not passed
      page = Math.max(1, page);
      try {
        if (ObjectID.isValid(userId)) {
          const posts = await Post.find({ user: new ObjectID(userId) })
            .limit(perPage)
            .skip(perPage * (page - 1));
          const totalPostCount = await Post.find({
            user: new ObjectID(userId),
          }).count();

          if (posts) {
            const result = {
              posts,
              totalPages: Math.ceil(totalPostCount / perPage),
              totalPosts: totalPostCount,
            };
            return result;
            
          } else {
            throw new ApolloError(
              'Post not found please check again',
              'POST_NOT_FOUND'
            );
          }
        } else {
          
          throw new ApolloError(
            "User doesn't exist check authentication",
            'USER_NOT_FOUND'
          );
        }
      } catch (err) {
        throw err;
      }
    },
  },
  Mutation: {
    async createPost(_, { title, body, tags }, context) {
      try {
        const user = checkAuth(context);

        if (title.trim() === '') {
          throw new Error('Post title must not be empty');
        } else if (body.trim() === '') {
          throw new Error('Post body must not be empty');
        } else if (tags === null || tags.length == 0) {
          throw new Error('Post Tags must not be empty');
        }

        const newPost = new Post({
          question: {
            title: title,
            body: body,
            tags: tags,
            username: user.username,
          },
          createdAt: new Date().toISOString(),
          user: user.id,
        });

        const post = await newPost.save();
        return post;
      } catch (error) {
        throw error;
      }
    },
    async deletePost(_, { postId }, context) {
      const user = checkAuth(context);

      try {
        const post = await Post.findById(postId);
        if (user.username === post.question.username) {
          await post.delete();
          return 'Post deleted successfully';
        } else {
          throw new AuthenticationError('Action not allowed');
        }
      } catch (err) {
        throw new Error(err);
      }
    },
    async upvotePost(_, { postId }, context) {
      try {
        const { username } = checkAuth(context);

        const post = await Post.findById(postId);
        if (post) {
          if (
            post.question.upvotes.find((upvote) => upvote.username === username)
          ) {
            // Post already likes, unlike it
            post.question.upvotes = post.question.upvotes.filter(
              (upvote) => upvote.username !== username
            );
          } else {
            // Not liked
            if (
              post.question.downvotes.find(
                (downvote) => downvote.username === username
              )
            ) {
              // Post disliked then remove downvote
              post.question.downvotes = post.question.downvotes.filter(
                (downvote) => downvote.username !== username
              );
            }
            // upvote post
            post.question.upvotes.push({
              username,
              createdAt: new Date().toISOString(),
            });
          }
          post.question.voteCount =
            post.question.upvotes.length - post.question.downvotes.length;
          await post.save();
          return post;
        } else throw new Error('Post not found');
      } catch (error) {
        throw error;
      }
    },

    async downvotePost(_, { postId }, context) {
      try {
        const { username } = checkAuth(context);

        const post = await Post.findById(postId);
        if (post) {
          if (
            post.question.downvotes.find(
              (downvote) => downvote.username === username
            )
          ) {
            // Post already disliked
            post.question.downvotes = post.question.downvotes.filter(
              (downvote) => downvote.username !== username
            );
          } else {
            // Post not disliked
            if (
              post.question.upvotes.find(
                (upvote) => upvote.username === username
              )
            ) {
              // Post liked then remove upvote
              post.question.upvotes = post.question.upvotes.filter(
                (upvote) => upvote.username !== username
              );
            }
            // downvote post
            post.question.downvotes.push({
              username,
              createdAt: new Date().toISOString(),
            });
          }

          post.question.voteCount =
            post.question.upvotes.length - post.question.downvotes.length;
          await post.save();
          return post;
        } else {
          throw new Error('Post not found');
        }
      } catch (error) {
        throw error;
      }
    },
  },
  Subscription: {},
};
