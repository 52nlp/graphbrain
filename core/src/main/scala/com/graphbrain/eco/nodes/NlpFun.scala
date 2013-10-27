package com.graphbrain.eco.nodes

import com.graphbrain.eco.{Contexts, NodeType, Context}
import scala.Boolean
import com.graphbrain.eco.NodeType.NodeType
import com.graphbrain.eco.nodes.NlpFunType.NlpFunType

object NlpFunType extends Enumeration {
  type NlpFunType = Value
  val IS_POS, IS_POSPRE, ARE_POS, ARE_POSPRE, IS_LEMMA = Value
}

class NlpFun(val funType: NlpFunType, params: Array[ProgNode], lastTokenPos: Int= -1) extends FunNode(params, lastTokenPos) {

  override val label = funType match {
    case NlpFunType.IS_POS => "is-pos"
    case NlpFunType.IS_POSPRE => "is-pos-pre"
    case NlpFunType.ARE_POS => "are-pos"
    case NlpFunType.ARE_POSPRE => "are-pos-pre"
    case NlpFunType.IS_LEMMA => "is-lemma"
  }

  override def ntype(ctxt: Context): NodeType = NodeType.Boolean

  override def booleanValue(ctxts: Contexts, ctxt: Context): Boolean = funType match {
    case NlpFunType.IS_POS => {
      params(0) match {
        case v: VarNode => {
          val words = v.wordsValue(ctxts, ctxt)
          if (words.count != 1) return false
          words.words(0).pos == params(1).stringValue(ctxts, ctxt)
        }
      }
    }
    case NlpFunType.IS_POSPRE => {
      params(0) match {
        case v: VarNode => {
          val words = v.wordsValue(ctxts, ctxt)
          if (words.count != 1) return false
          words.words(0).pos.startsWith(params(1).stringValue(ctxts, ctxt))
        }
      }
    }
    case NlpFunType.ARE_POS => {
      params(0) match {
        case v: VarNode => {
          val words = v.wordsValue(ctxts, ctxt)
          if (words.count == 0) return false
          val pos = params(1).stringValue(ctxts, ctxt)
          for (w <- words.words)
            if (w.pos != pos) return false
          true
        }
      }
    }
    case NlpFunType.ARE_POSPRE => {
      params(0) match {
        case v: VarNode => {
          val words = v.wordsValue(ctxts, ctxt)
          if (words.count == 0) return false
          val pos = params(1).stringValue(ctxts, ctxt)
          for (w <- words.words)
            if (!w.pos.startsWith(pos)) return false
          true
        }
      }
    }
    case NlpFunType.IS_LEMMA => {
      params(0) match {
        case v: VarNode => {
          val words = v.wordsValue(ctxts, ctxt)
          if (words.count != 1) return false
          words.words(0).lemma == params(1).stringValue(ctxts, ctxt)
        }
      }
    }
  }
}