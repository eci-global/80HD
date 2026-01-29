import { createCatalog } from '@json-render/core';
import { z } from 'zod';

export const teamActivityCatalog = createCatalog({
  components: {
    // Layout components
    Dashboard: {
      props: z.object({
        title: z.string(),
        period: z.string(),
        generated: z.string().optional(),
      }),
      hasChildren: true,
    },
    Grid: {
      props: z.object({
        columns: z.number().default(4),
        gap: z.number().default(4),
      }),
      hasChildren: true,
    },
    Section: {
      props: z.object({
        title: z.string(),
        collapsible: z.boolean().default(false),
      }),
      hasChildren: true,
    },

    // Metric components
    MetricCard: {
      props: z.object({
        label: z.string(),
        value: z.number(),
        trend: z.enum(['up', 'down', 'flat']).optional(),
        trendValue: z.string().optional(),
        icon: z.enum(['commit', 'pr-merged', 'pr-open', 'user', 'repo', 'warning']),
        color: z.enum(['blue', 'green', 'orange', 'red', 'purple', 'gray']).default('blue'),
      }),
    },

    // Contributor components
    ContributorCard: {
      props: z.object({
        name: z.string(),
        username: z.string().optional(),
        commits: z.number(),
        prsMerged: z.number(),
        prsOpen: z.number(),
        topRepos: z.array(z.string()).optional(),
      }),
    },
    ContributorTable: {
      props: z.object({
        contributors: z.array(z.object({
          name: z.string(),
          username: z.string().optional(),
          commits: z.number(),
          prsMerged: z.number(),
          prsOpen: z.number(),
        })),
      }),
    },

    // Repository components
    RepoCard: {
      props: z.object({
        name: z.string(),
        platform: z.enum(['github', 'ado']),
        commits: z.number(),
        prsMerged: z.number(),
        prsOpen: z.number(),
        status: z.enum(['active', 'low', 'inactive']).default('active'),
      }),
    },
    RepoTable: {
      props: z.object({
        repos: z.array(z.object({
          name: z.string(),
          platform: z.enum(['github', 'ado']),
          commits: z.number(),
          prsMerged: z.number(),
          prsOpen: z.number(),
        })),
      }),
    },

    // PR components
    PRAlert: {
      props: z.object({
        repo: z.string(),
        number: z.number(),
        title: z.string(),
        author: z.string(),
        age: z.string(),
        status: z.enum(['stale', 'needs-review', 'in-review', 'approved']),
        url: z.string().optional(),
      }),
    },
    PRList: {
      props: z.object({
        prs: z.array(z.object({
          repo: z.string(),
          number: z.number(),
          title: z.string(),
          author: z.string(),
          age: z.string(),
          status: z.enum(['stale', 'needs-review', 'in-review', 'approved']),
        })),
      }),
    },

    // Chart components
    BarChart: {
      props: z.object({
        title: z.string().optional(),
        data: z.array(z.object({
          label: z.string(),
          value: z.number(),
          color: z.string().optional(),
        })),
        height: z.number().default(200),
      }),
    },
    PieChart: {
      props: z.object({
        title: z.string().optional(),
        data: z.array(z.object({
          label: z.string(),
          value: z.number(),
          color: z.string().optional(),
        })),
        height: z.number().default(200),
      }),
    },
    ActivityTimeline: {
      props: z.object({
        data: z.array(z.object({
          date: z.string(),
          commits: z.number(),
          prs: z.number(),
        })),
        height: z.number().default(150),
      }),
    },

    // Commit components
    CommitList: {
      props: z.object({
        commits: z.array(z.object({
          sha: z.string(),
          author: z.string(),
          message: z.string(),
          repo: z.string(),
          date: z.string().optional(),
        })),
        limit: z.number().default(10),
      }),
    },

    // Text components
    Text: {
      props: z.object({
        content: z.string(),
        variant: z.enum(['body', 'heading', 'subheading', 'caption', 'warning']).default('body'),
      }),
    },
    Alert: {
      props: z.object({
        message: z.string(),
        type: z.enum(['info', 'warning', 'error', 'success']),
      }),
    },
  },

  actions: {
    refresh: { params: z.object({}) },
    export: { params: z.object({ format: z.enum(['html', 'pdf', 'json']) }) },
    filterByAuthor: { params: z.object({ author: z.string() }) },
    filterByRepo: { params: z.object({ repo: z.string() }) },
  },
});

export type TeamActivityCatalog = typeof teamActivityCatalog;
