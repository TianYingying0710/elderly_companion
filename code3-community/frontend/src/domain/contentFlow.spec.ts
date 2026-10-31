import { describe, expect, it } from 'vitest'
import {
  courseAfterAction,
  coursePublishLabel,
  knowledgeAfterReview,
  knowledgeAfterToggle,
  knowledgeMeta,
} from './contentFlow'

describe('knowledgeFlow', () => {
  it('审核通过后进入已启用', () => {
    expect(knowledgeAfterReview('待确认')).toBe('已启用')
  })

  it('非待确认状态审核不改变状态', () => {
    expect(knowledgeAfterReview('已启用')).toBe('已启用')
    expect(knowledgeAfterReview('已停用')).toBe('已停用')
  })

  it('停用与重新启用可来回切换', () => {
    expect(knowledgeAfterToggle('已启用')).toBe('已停用')
    expect(knowledgeAfterToggle('已停用')).toBe('已启用')
  })

  it('待确认不参与启停切换', () => {
    expect(knowledgeAfterToggle('待确认')).toBe('待确认')
  })

  it('副标题随状态变化', () => {
    expect(knowledgeMeta('待确认')).toBe('Word 文档 · 待审核')
    expect(knowledgeMeta('已启用')).toBe('Word 文档 · 已提供给老人端 AI')
    expect(knowledgeMeta('已停用')).toBe('Word 文档 · 当前未提供给老人端 AI')
  })
})

describe('courseFlow', () => {
  it('发布与下架', () => {
    expect(courseAfterAction('草稿', 'publish')).toBe('已发布')
    expect(courseAfterAction('已发布', 'unpublish')).toBe('已下架')
  })

  it('已下架可重新发布', () => {
    expect(courseAfterAction('已下架', 'publish')).toBe('已发布')
  })

  it('已下架时按钮显示重新发布', () => {
    expect(coursePublishLabel('已下架')).toBe('重新发布')
    expect(coursePublishLabel('草稿')).toBe('发布课程')
    expect(coursePublishLabel('已发布')).toBe('发布课程')
  })
})
